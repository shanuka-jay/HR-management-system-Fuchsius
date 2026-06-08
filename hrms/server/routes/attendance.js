const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { createNotification, getDirectManagerUserId } = require('../utils/notificationTargets')
const { evaluateAttendance, loadAttendanceSettings } = require('../utils/attendanceRules')

const prisma = new PrismaClient()

const getToday = () => new Date().toISOString().slice(0, 10)
const formatTime = (date) => `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
const minutesSinceMidnight = (date) => date.getHours() * 60 + date.getMinutes()
const timeToMinutes = (time) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

const nextEmployeeId = async () => {
  const all = await prisma.employee.findMany({ select: { id: true } })
  const maxNum = all.reduce((max, e) => {
    const n = parseInt(String(e.id).replace('E', ''), 10)
    return n > max ? n : max
  }, 0)
  return `E${String(maxNum + 1).padStart(3, '0')}`
}

const ensureAttendanceEmployee = async (user) => {
  const existing = await prisma.employee.findUnique({ where: { userId: user.id } })
  if (existing) return existing

  const id = await nextEmployeeId()
  return prisma.employee.create({
    data: {
      id,
      userId: user.id,
      name: user.name,
      email: user.email,
      dept: user.dept || (user.role === 'admin' ? 'Administration' : 'General'),
      role: user.title || user.role,
      manager: null,
      salary: 0,
      joined: getToday(),
      status: 'Active',
      employmentType: 'Full-time',
      leaveBalance: user.role === 'employee' ? 14 : 0,
    },
  })
}

const canManagerAccessEmployee = async (user, employeeId) => {
  if (user.role !== 'manager') return true
  const [managerEmp, target] = await Promise.all([
    prisma.employee.findUnique({ where: { userId: user.id } }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
  ])
  if (!target) return false
  return (managerEmp && target.managerId === managerEmp.id) || target.manager === user.name || target.userId === user.id
}

const serializeAttendanceRecord = (record, employee, settings = null) => {
  const evaluation = record && settings ? evaluateAttendance(record, settings) : null
  return {
  employee: {
    id: employee.id,
    name: employee.name,
    dept: employee.dept,
    role: employee.role,
  },
  today: record ? {
    date: record.date,
    checkIn: record.checkIn || '-',
    checkOut: record.checkOut || '-',
    hours: record.hours,
    status: evaluation?.status || record.status,
    shift: evaluation?.shift || '',
    shiftStart: evaluation?.shiftStart || '',
    shiftEnd: evaluation?.shiftEnd || '',
    lateMinutes: evaluation?.lateMinutes || 0,
    earlyLeaveMinutes: evaluation?.earlyLeaveMinutes || 0,
    shiftResult: evaluation?.shiftResult || '',
  } : null,
  }
}

// GET /api/attendance/me
router.get('/me', auth, async (req, res) => {
  try {
    const emp = await ensureAttendanceEmployee(req.user)
    const today = getToday()
    const record = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    })
    const settings = await loadAttendanceSettings(prisma)
    res.json(serializeAttendanceRecord(record, emp, settings))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/attendance/today
router.get('/today', auth, async (req, res) => {
  try {
    const today = getToday()
    const records = await prisma.attendance.findMany({
      where: { date: today },
      include: { employee: { select: { name: true, dept: true } } },
      orderBy: { employee: { name: 'asc' } },
    })
    const settings = await loadAttendanceSettings(prisma)

    const result = records.map(r => ({
      id:       r.employeeId,
      name:     r.employee.name,
      dept:     r.employee.dept,
      checkIn:  r.checkIn  || '-',
      checkOut: r.checkOut || '-',
      hours:    r.hours,
      status:   evaluateAttendance(r, settings).status,
      shift:    evaluateAttendance(r, settings).shift,
      shiftStart: evaluateAttendance(r, settings).shiftStart,
      shiftEnd: evaluateAttendance(r, settings).shiftEnd,
      lateMinutes: evaluateAttendance(r, settings).lateMinutes,
      earlyLeaveMinutes: evaluateAttendance(r, settings).earlyLeaveMinutes,
      shiftResult: evaluateAttendance(r, settings).shiftResult,
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/attendance/monthly
router.get('/monthly', auth, async (req, res) => {
  try {
    const records = await prisma.attendance.findMany()
    const settings = await loadAttendanceSettings(prisma)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const byMonth = new Map()
    for (const r of records) {
      const date = new Date(`${r.date}T00:00:00`)
      if (Number.isNaN(date.getTime())) continue
      const key = months[date.getMonth()]
      if (!byMonth.has(key)) byMonth.set(key, { month: key, present: 0, absent: 0, late: 0, completed: 0, earlyLeave: 0, lateMinutes: 0 })
      const row = byMonth.get(key)
      const evaluation = evaluateAttendance(r, settings)
      if (evaluation.status === 'Late') row.late += 1
      else if (evaluation.status === 'Absent') row.absent += 1
      else if (evaluation.status === 'Present') row.present += 1
      if (evaluation.completedShift) row.completed += 1
      if (evaluation.earlyLeaveMinutes > 0) row.earlyLeave += 1
      row.lateMinutes += evaluation.lateMinutes
    }
    res.json(months.filter(m => byMonth.has(m)).map(m => byMonth.get(m)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/attendance/employee/:empId — employee's own attendance history
router.get('/employee/:empId', auth, async (req, res) => {
  try {
    // Employees can only see their own
    if (req.user.role === 'employee') {
      const myEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!myEmp || myEmp.id !== req.params.empId) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }
    if (req.user.role === 'manager' && !(await canManagerAccessEmployee(req.user, req.params.empId))) {
      return res.status(403).json({ error: 'Managers can only view attendance for direct reports' })
    }

    const records = await prisma.attendance.findMany({
      where: { employeeId: req.params.empId },
      orderBy: { date: 'desc' },
      take: 30,
    })
    const settings = await loadAttendanceSettings(prisma)

    res.json(records.map(r => ({
      date:     r.date,
      checkIn:  r.checkIn  || '-',
      checkOut: r.checkOut || '-',
      hours:    r.hours,
      status:   evaluateAttendance(r, settings).status,
      shift:    evaluateAttendance(r, settings).shift,
      shiftStart: evaluateAttendance(r, settings).shiftStart,
      shiftEnd: evaluateAttendance(r, settings).shiftEnd,
      lateMinutes: evaluateAttendance(r, settings).lateMinutes,
      earlyLeaveMinutes: evaluateAttendance(r, settings).earlyLeaveMinutes,
      shiftResult: evaluateAttendance(r, settings).shiftResult,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/attendance/corrections
router.get('/corrections', auth, async (req, res) => {
  try {
    const where = {}
    if (req.query.status) where.status = req.query.status

    if (req.user.role === 'employee') {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!emp) return res.json([])
      where.employeeId = emp.id
    }

    const corrections = await prisma.attendanceCorrection.findMany({
      where,
      include: { employee: { select: { name: true, dept: true, manager: true, managerId: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const managerEmp = req.user.role === 'manager'
      ? await prisma.employee.findUnique({ where: { userId: req.user.id } })
      : null
    const visible = req.user.role === 'manager'
      ? corrections.filter(c => (managerEmp && c.employee.managerId === managerEmp.id) || c.employee.manager === req.user.name)
      : corrections

    res.json(visible.map(c => ({
      id: c.id,
      employeeId: c.employeeId,
      employee: c.employee.name,
      dept: c.employee.dept,
      date: c.date,
      checkIn: c.checkIn,
      checkOut: c.checkOut,
      reason: c.reason,
      status: c.status,
      decisionNote: c.decisionNote,
      requestedOn: c.requestedOn,
      decidedBy: c.decidedBy,
      decidedOn: c.decidedOn,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/attendance/corrections
router.post('/corrections', auth, async (req, res) => {
  try {
    const { date, checkIn, checkOut, reason } = req.body
    if (!date || !reason) return res.status(400).json({ error: 'Date and reason are required' })

    let employeeId = req.body.employeeId
    if (req.user.role === 'employee') {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!emp) return res.status(404).json({ error: 'Employee record not found' })
      employeeId = emp.id
    }

    const correction = await prisma.attendanceCorrection.create({
      data: {
        employeeId,
        date,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        reason,
        requestedOn: new Date().toISOString().slice(0, 10),
      },
      include: { employee: { select: { name: true, userId: true, manager: true, managerId: true } } },
    })

    const managerUserId = await getDirectManagerUserId(prisma, correction.employee)
    await createNotification(prisma, {
      type: 'attendance',
      msg: `${correction.employee.name} requested an attendance correction for ${date}`,
      path: '/hr/attendance',
      audience: ['hr', 'admin'],
    })
    if (managerUserId) {
      await createNotification(prisma, {
        type: 'attendance',
        msg: `${correction.employee.name} requested an attendance correction for ${date}`,
        path: '/manager/attendance',
        userIds: [managerUserId],
      })
    }

    res.status(201).json(correction)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/attendance/corrections/:id
router.patch('/corrections/:id', auth, requireRole('admin', 'hr', 'manager'), async (req, res) => {
  try {
    const { status, note } = req.body
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Status must be Approved or Rejected' })

    const existing = await prisma.attendanceCorrection.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { manager: true, managerId: true, name: true } } },
    })
    if (!existing) return res.status(404).json({ error: 'Correction request not found' })
    if (req.user.role === 'manager') {
      const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      const ownsById = managerEmp && existing.employee.managerId === managerEmp.id
      const ownsByName = existing.employee.manager === req.user.name
      if (!ownsById && !ownsByName) {
        return res.status(403).json({ error: 'Managers can only decide direct report corrections' })
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const correction = await tx.attendanceCorrection.update({
        where: { id: req.params.id },
        data: {
          status,
          decisionNote: note || null,
          decidedBy: req.user.name,
          decidedOn: new Date().toISOString().slice(0, 10),
        },
      })

      if (status === 'Approved') {
        const settings = await loadAttendanceSettings(tx)
        const draft = {
          checkIn: existing.checkIn || null,
          checkOut: existing.checkOut || null,
        }
        const evaluated = evaluateAttendance(draft, settings)
        const data = {
          checkIn: existing.checkIn || null,
          checkOut: existing.checkOut || null,
          status: existing.checkIn ? evaluated.status : 'Absent',
        }
        if (existing.checkIn && existing.checkOut) {
          data.hours = Math.max(0, parseFloat(((timeToMinutes(existing.checkOut) - timeToMinutes(existing.checkIn)) / 60).toFixed(2)))
        }
        await tx.attendance.upsert({
          where: { employeeId_date: { employeeId: existing.employeeId, date: existing.date } },
          update: data,
          create: { employeeId: existing.employeeId, date: existing.date, ...data, hours: data.hours || 0 },
        })
      }

      return correction
    })

    const employee = await prisma.employee.findUnique({
      where: { id: existing.employeeId },
      select: { userId: true, name: true },
    })
    if (employee?.userId) {
      await createNotification(prisma, {
        type: 'attendance',
        msg: `Your attendance correction for ${existing.date} was ${status.toLowerCase()}`,
        path: '/employee/attendance',
        userIds: [employee.userId],
      })
    }

    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/attendance/checkin — employee checks in
router.post('/checkin', auth, async (req, res) => {
  try {
    const emp = await ensureAttendanceEmployee(req.user)
    if (!emp) return res.status(404).json({ error: 'Employee record not found' })

    const today = getToday()
    const now   = new Date()
    const time  = formatTime(now)
    const settings = await loadAttendanceSettings(prisma)
    const evaluated = evaluateAttendance({ checkIn: time, checkOut: null, hours: 0, status: 'Present' }, settings)
    const status = evaluated.status

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    })
    if (existing?.checkIn && !existing.checkOut) {
      return res.status(409).json({ error: `Already checked in today at ${existing.checkIn}` })
    }
    if (existing?.checkIn && existing?.checkOut) {
      return res.status(409).json({ error: `Attendance already completed today (${existing.checkIn} to ${existing.checkOut})` })
    }

    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
      update: { checkIn: time, status },
      create: { employeeId: emp.id, date: today, checkIn: time, status, hours: 0 },
    })

    res.json({
      message: status === 'Late'
        ? `Checked in late by ${evaluated.lateMinutes} min for ${evaluated.shift}`
        : `Checked in for ${evaluated.shift}`,
      time,
      status,
      shift: evaluated.shift,
      lateMinutes: evaluated.lateMinutes,
      record,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/attendance/checkout — employee checks out
router.post('/checkout', auth, async (req, res) => {
  try {
    const emp = await ensureAttendanceEmployee(req.user)
    if (!emp) return res.status(404).json({ error: 'Employee record not found' })

    const today = getToday()
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
    })

    if (!existing || !existing.checkIn) {
      return res.status(400).json({ error: 'No check-in record found for today' })
    }

    const now      = new Date()
    if (existing.checkOut) {
      return res.status(409).json({ error: `Already checked out today at ${existing.checkOut}` })
    }

    const time     = formatTime(now)
    const hours    = parseFloat(((minutesSinceMidnight(now) - timeToMinutes(existing.checkIn)) / 60).toFixed(2))

    const settings = await loadAttendanceSettings(prisma)
    const evaluated = evaluateAttendance({ ...existing, checkOut: time, hours: Math.max(0, hours) }, settings)
    const record = await prisma.attendance.update({
      where: { employeeId_date: { employeeId: emp.id, date: today } },
      data:  { checkOut: time, hours: Math.max(0, hours), status: evaluated.status },
    })

    res.json({
      message: `Checked out successfully - ${evaluated.shiftResult}`,
      time,
      hours,
      shift: evaluated.shift,
      earlyLeaveMinutes: evaluated.earlyLeaveMinutes,
      shiftResult: evaluated.shiftResult,
      record,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/attendance/:id — HR correction (id = cuid or empId_today)
router.patch('/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { checkIn, checkOut, status } = req.body
    const data = {}
    if (checkIn  !== undefined) data.checkIn  = checkIn  || null
    if (checkOut !== undefined) data.checkOut = checkOut || null
    if (status   !== undefined) data.status   = status

    // Recalculate hours if both times present
    const ci = data.checkIn  || null
    const co = data.checkOut || null
    if (ci && co) {
      data.hours = Math.max(0, parseFloat(((timeToMinutes(co) - timeToMinutes(ci)) / 60).toFixed(2)))
    }
    if (ci) {
      const settings = await loadAttendanceSettings(prisma)
      data.status = evaluateAttendance({ checkIn: ci, checkOut: co, hours: data.hours || 0, status: data.status || 'Present' }, settings).status
    }

    // Support empId_today pattern (e.g. "E001_today")
    let record
    if (req.params.id.includes('_today')) {
      const empId = req.params.id.replace('_today', '')
      const today = getToday()
      record = await prisma.attendance.upsert({
        where:  { employeeId_date: { employeeId: empId, date: today } },
        update: data,
        create: { employeeId: empId, date: today, ...data, hours: data.hours || 0 },
      })
    } else {
      record = await prisma.attendance.update({ where: { id: req.params.id }, data })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'CORRECT_ATTENDANCE', module: 'Attendance', detail: `Corrected attendance record ${req.params.id}`, ip: req.ip },
    })

    res.json(record)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
