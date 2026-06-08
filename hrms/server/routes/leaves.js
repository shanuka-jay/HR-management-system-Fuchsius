const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { createNotification, getDirectManagerUserId } = require('../utils/notificationTargets')

const prisma = new PrismaClient()

const ensureLeaveDecisionAccess = async (req, leaveId) => {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { employee: { select: { manager: true, managerId: true } } },
  })
  if (!leave) return { error: 'Leave request not found', status: 404 }
  if (req.user.role === 'manager') {
    const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
    const ownsById = managerEmp && leave.employee.managerId === managerEmp.id
    const ownsByName = leave.employee.manager === req.user.name
    if (!ownsById && !ownsByName) {
      return { error: 'Managers can only approve or reject direct reports', status: 403 }
    }
  }
  return { leave }
}

const toDateOnly = (date) => new Date(`${date}T00:00:00`)
const isWeekend = (date) => [0, 6].includes(date.getDay())
const countBusinessDays = (start, end, holidaySet) => {
  let days = 0
  const cursor = toDateOnly(start)
  const last = toDateOnly(end)
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10)
    if (!isWeekend(cursor) && !holidaySet.has(iso)) days += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// GET /api/leaves
router.get('/', auth, async (req, res) => {
  try {
    const { status, type, employeeId } = req.query
    const where = {}
    if (status)     where.status     = status
    if (type)       where.type       = type
    if (employeeId) where.employeeId = employeeId

    // Employees can only see their own leaves
    if (req.user.role === 'employee') {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (emp) where.employeeId = emp.id
    }
    if (req.user.role === 'manager') {
      const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      const directReportFilter = {
        OR: [
          ...(managerEmp ? [{ managerId: managerEmp.id }] : []),
          { manager: req.user.name },
        ],
      }
      if (where.employeeId) {
        where.AND = [{ employeeId: where.employeeId }, { employee: { is: directReportFilter } }]
        delete where.employeeId
      } else {
        where.employee = { is: directReportFilter }
      }
    }

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { name: true, dept: true, role: true, manager: true, managerId: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const result = leaves.map(l => ({
      id:         l.id,
      employee:   l.employee.name,
      empId:      l.employeeId,
      dept:       l.employee.dept,
      type:       l.type,
      start:      l.start,
      end:        l.end,
      days:       l.days,
      status:     l.status,
      reason:     l.reason,
      manager:    l.employee.manager,
      managerId:  l.employee.managerId,
      decisionNote: l.decisionNote,
      decidedBy:   l.decidedBy,
      decidedOn:   l.decidedOn,
      appliedOn:  l.appliedOn,
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/leaves — apply for leave
router.post('/', auth, async (req, res) => {
  try {
    const { type, start, end, reason, employeeId } = req.body

    // Determine which employee
    let empId = employeeId
    if (req.user.role === 'employee') {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!emp) return res.status(404).json({ error: 'Employee record not found' })
      empId = emp.id
    }

    if (!type || !start || !end) return res.status(400).json({ error: 'Leave type, start date and end date are required' })
    if (!empId) return res.status(400).json({ error: 'Employee is required' })

    const employee = await prisma.employee.findUnique({ where: { id: empId } })
    if (!employee) return res.status(404).json({ error: 'Employee record not found' })

    const startDate = new Date(start)
    const endDate   = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      return res.status(400).json({ error: 'Leave end date must be on or after the start date' })
    }

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: empId,
        status: { in: ['Pending', 'Pending HR', 'Approved'] },
        start: { lte: end },
        end: { gte: start },
      },
    })
    if (overlap) {
      return res.status(400).json({ error: 'This leave overlaps an existing pending or approved request' })
    }

    const holidays = await prisma.holiday.findMany({ where: { date: { gte: start, lte: end } } })
    const holidaySet = new Set(holidays.map(h => h.date))
    const days = countBusinessDays(start, end, holidaySet)
    if (days < 1) return res.status(400).json({ error: 'Selected dates contain no working days' })
    if (type !== 'Maternity' && days > employee.leaveBalance) {
      return res.status(400).json({ error: `Insufficient leave balance. Available balance is ${employee.leaveBalance} day(s).` })
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        employeeId: empId,
        type,
        start,
        end,
        days,
        status:    'Pending',
        reason:    reason || null,
        appliedOn: new Date().toISOString().slice(0, 10),
      },
      include: { employee: { select: { name: true, userId: true, manager: true, managerId: true } } },
    })

    const managerUserId = await getDirectManagerUserId(prisma, leave.employee)
    if (!managerUserId) {
      await createNotification(prisma, {
        type:     'leave',
        msg:      `${leave.employee.name} applied for ${type} leave (${start} to ${end})`,
        path:     '/hr/leave',
        audience: ['hr', 'admin'],
      })
    }
    if (managerUserId) {
      await createNotification(prisma, {
        type:    'leave',
        msg:     `${leave.employee.name} applied for ${type} leave (${start} to ${end})`,
        path:    '/manager/leave',
        userIds: [managerUserId],
      })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'APPLY_LEAVE', module: 'Leave', detail: `Leave applied for ${leave.employee.name}`, ip: req.ip },
    })

    res.status(201).json({
      id: leave.id, employee: leave.employee.name, empId: leave.employeeId,
      type: leave.type, start: leave.start, end: leave.end,
      days: leave.days, status: leave.status, reason: leave.reason, appliedOn: leave.appliedOn,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/leaves/:id/approve
router.patch('/:id/approve', auth, requireRole('admin', 'hr', 'manager'), async (req, res) => {
  try {
    const access = await ensureLeaveDecisionAccess(req, req.params.id)
    if (access.error) return res.status(access.status).json({ error: access.error })
    const { note } = req.body

    if (!['Pending', 'Pending HR'].includes(access.leave.status)) {
      return res.status(400).json({ error: `Leave request is already ${access.leave.status.toLowerCase()}` })
    }

    if (req.user.role === 'manager') {
      if (access.leave.status !== 'Pending') {
        return res.status(400).json({ error: 'This request is already waiting for HR final approval' })
      }

      const leave = await prisma.leaveRequest.update({
        where: { id: req.params.id },
        data:  {
          status: 'Pending HR',
          decisionNote: note ? `Manager approved: ${note}` : 'Manager approved',
          decidedBy: req.user.name,
          decidedOn: new Date().toISOString().slice(0, 10),
        },
        include: { employee: { select: { name: true, userId: true, manager: true, managerId: true } } },
      })

      await createNotification(prisma, {
        type:     'leave',
        msg:      `${leave.employee.name}'s ${leave.type} leave was approved by the manager and needs HR approval`,
        path:     '/hr/leave',
        audience: ['hr', 'admin'],
      })
      await createNotification(prisma, {
        type:    'leave',
        msg:     `Your ${leave.type} leave was approved by your manager and is waiting for HR`,
        path:    '/employee/leave',
        userIds: [leave.employee.userId],
      })

      await prisma.auditLog.create({
        data: { userId: req.user.id, action: 'MANAGER_APPROVE_LEAVE', module: 'Leave', detail: `Manager approved leave ${req.params.id}`, ip: req.ip },
      })

      return res.json({ id: leave.id, status: leave.status, employee: leave.employee.name, decisionNote: leave.decisionNote, decidedBy: leave.decidedBy, decidedOn: leave.decidedOn })
    }

    if ((access.leave.employee.managerId || access.leave.employee.manager) && access.leave.status === 'Pending') {
      return res.status(400).json({ error: 'Manager approval is required before HR final approval' })
    }

    const finalApproveNote = note
      ? `${access.leave.decisionNote ? `${access.leave.decisionNote} | ` : ''}HR approved: ${note}`
      : access.leave.decisionNote || 'HR approved'

    const leave = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id: req.params.id },
        data:  {
          status: 'Approved',
          decisionNote: finalApproveNote,
          decidedBy: req.user.name,
          decidedOn: new Date().toISOString().slice(0, 10),
        },
        include: { employee: { select: { name: true, leaveBalance: true, userId: true, manager: true, managerId: true } } },
      })
      if (access.leave.status !== 'Approved') {
        await tx.employee.update({
          where: { id: updated.employeeId },
          data: { leaveBalance: Math.max(0, updated.employee.leaveBalance - updated.days) },
        })
      }
      return updated
    })

    const managerUserId = await getDirectManagerUserId(prisma, leave.employee)
    await createNotification(prisma, {
      type:     'leave',
      msg:      `${leave.employee.name}'s ${leave.type} leave was finally approved by HR`,
      path:     '/hr/leave',
      audience: ['hr', 'admin'],
    })
    await createNotification(prisma, {
      type:     'leave',
      msg:      `Your ${leave.type} leave was finally approved by HR`,
      path:     '/employee/leave',
      userIds:  [leave.employee.userId],
    })
    if (managerUserId) {
      await createNotification(prisma, {
        type:    'leave',
        msg:     `${leave.employee.name}'s ${leave.type} leave was approved`,
        path:    '/manager/leave',
        userIds: [managerUserId],
      })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'APPROVE_LEAVE', module: 'Leave', detail: `Approved leave ${req.params.id}`, ip: req.ip },
    })

    res.json({ id: leave.id, status: leave.status, employee: leave.employee.name, decisionNote: leave.decisionNote, decidedBy: leave.decidedBy, decidedOn: leave.decidedOn })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/leaves/:id/reject
router.patch('/:id/reject', auth, requireRole('admin', 'hr', 'manager'), async (req, res) => {
  try {
    const access = await ensureLeaveDecisionAccess(req, req.params.id)
    if (access.error) return res.status(access.status).json({ error: access.error })
    const { note } = req.body

    if (!['Pending', 'Pending HR'].includes(access.leave.status)) {
      return res.status(400).json({ error: `Leave request is already ${access.leave.status.toLowerCase()}` })
    }
    if (req.user.role === 'manager' && access.leave.status !== 'Pending') {
      return res.status(400).json({ error: 'This request is already waiting for HR final approval' })
    }
    if (req.user.role !== 'manager' && (access.leave.employee.managerId || access.leave.employee.manager) && access.leave.status === 'Pending') {
      return res.status(400).json({ error: 'Manager review is required before HR decision' })
    }

    const finalRejectNote = note
      ? `${access.leave.decisionNote ? `${access.leave.decisionNote} | ` : ''}${req.user.role === 'manager' ? 'Manager rejected' : 'HR rejected'}: ${note}`
      : access.leave.decisionNote || `${req.user.role === 'manager' ? 'Manager' : 'HR'} rejected`

    const leave = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data:  {
        status: 'Rejected',
        decisionNote: finalRejectNote,
        decidedBy: req.user.name,
        decidedOn: new Date().toISOString().slice(0, 10),
      },
      include: { employee: { select: { name: true, userId: true, manager: true, managerId: true } } },
    })

    const managerUserId = await getDirectManagerUserId(prisma, leave.employee)
    await createNotification(prisma, {
      type:     'leave',
      msg:      `${leave.employee.name}'s ${leave.type} leave was rejected`,
      path:     '/hr/leave',
      audience: ['hr', 'admin'],
    })
    await createNotification(prisma, {
      type:     'leave',
      msg:      `Your ${leave.type} leave was rejected`,
      path:     '/employee/leave',
      userIds:  [leave.employee.userId],
    })
    if (managerUserId) {
      await createNotification(prisma, {
        type:    'leave',
        msg:     `${leave.employee.name}'s ${leave.type} leave was rejected`,
        path:    '/manager/leave',
        userIds: [managerUserId],
      })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'REJECT_LEAVE', module: 'Leave', detail: `Rejected leave ${req.params.id}`, ip: req.ip },
    })

    res.json({ id: leave.id, status: leave.status, employee: leave.employee.name, decisionNote: leave.decisionNote, decidedBy: leave.decidedBy, decidedOn: leave.decidedOn })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
