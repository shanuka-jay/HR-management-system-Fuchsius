const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { createNotification } = require('../utils/notificationTargets')
const { savePayslipPdf, sendPayslipEmail } = require('../utils/payslip')
const { evaluateAttendance, loadAttendanceSettings } = require('../utils/attendanceRules')

const prisma = new PrismaClient()

const today = () => new Date().toISOString().slice(0, 10)
const toInt = (value, fallback = 0) => parseInt(value, 10) || fallback
const toFloat = (value, fallback = 0) => parseFloat(value) || fallback
const monthIndex = (month = '') => {
  const parsed = Date.parse(`1 ${month}`)
  return Number.isNaN(parsed) ? 0 : parsed
}

const monthRange = (month = '') => {
  const start = new Date(`1 ${month}`)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  const iso = (date) => date.toISOString().slice(0, 10)
  return { from: iso(start), to: iso(end) }
}

const getSettings = () => prisma.payrollSetting.upsert({
  where: { id: 'default' },
  update: {},
  create: { id: 'default' },
})

const serializeRecord = (p, currencyOverride = null) => ({
  id: p.id,
  empId: p.employeeId,
  name: p.employee?.name || '',
  dept: p.employee?.dept || '',
  month: p.month,
  currency: currencyOverride || p.currency,
  basic: p.basic,
  allowances: p.allowances,
  overtime: p.overtime,
  bonus: p.bonus,
  reimbursements: p.reimbursements,
  unpaidLeaveDeduction: p.unpaidLeaveDeduction,
  recurringDeductions: p.recurringDeductions,
  oneTimeDeductions: p.oneTimeDeductions,
  gross: p.gross,
  deductions: p.deductions,
  tax: p.tax,
  net: p.net,
  status: p.status,
  approvedBy: p.approvedBy,
  approvedOn: p.approvedOn,
  paidOn: p.paidOn,
  issued: p.paidOn || p.createdAt?.toISOString?.().slice(0, 10),
  attendanceImpact: p.attendanceImpact || null,
})

const getAttendanceImpact = async (employeeId, month, attendanceSettings = null) => {
  const range = monthRange(month)
  if (!range) {
    return { absentDays: 0, approvedLeaveDays: 0, lateMinutes: 0, earlyLeaveMinutes: 0, attendanceUnpaidDays: 0, attendanceRecords: 0 }
  }

  const settings = attendanceSettings || await loadAttendanceSettings(prisma)
  const [records, approvedLeaves] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: range.from, lte: range.to },
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'Approved',
        start: { lte: range.to },
        end: { gte: range.from },
      },
    }),
  ])
  const approvedLeaveDays = approvedLeaves.reduce((sum, leave) => sum + (Number(leave.days) || 0), 0)

  const totals = records.reduce((sum, record) => {
    const evaluated = evaluateAttendance(record, settings)
    const expectedMinutes = Math.max(1, Math.round((evaluated?.expectedHours || 8) * 60))
    if (evaluated?.status === 'Absent') {
      sum.absentDays += 1
      sum.attendanceUnpaidDays += 1
      return sum
    }
    if (evaluated?.status === 'On Leave') return sum

    const lateMinutes = evaluated?.lateMinutes || 0
    const earlyLeaveMinutes = evaluated?.earlyLeaveMinutes || 0
    sum.lateMinutes += lateMinutes
    sum.earlyLeaveMinutes += earlyLeaveMinutes
    sum.attendanceUnpaidDays += Math.min(1, (lateMinutes + earlyLeaveMinutes) / expectedMinutes)
    return sum
  }, { absentDays: 0, lateMinutes: 0, earlyLeaveMinutes: 0, attendanceUnpaidDays: 0 })

  return {
    ...totals,
    approvedLeaveDays,
    attendanceRecords: records.length,
    attendanceUnpaidDays: Number((totals.attendanceUnpaidDays + approvedLeaveDays).toFixed(2)),
  }
}

const attachAttendanceImpact = async (records) => {
  const attendanceSettings = await loadAttendanceSettings(prisma)
  return Promise.all(records.map(async record => ({
    ...record,
    attendanceImpact: await getAttendanceImpact(record.employeeId, record.month, attendanceSettings),
  })))
}

const getCompensation = async (employee) => {
  const monthlyBase = Math.round(employee.salary || 0)
  return prisma.compensationStructure.upsert({
    where: { employeeId: employee.id },
    update: {},
    create: {
      employeeId: employee.id,
      basicSalary: monthlyBase,
    },
  })
}

const getVariables = (employeeId, month) => prisma.payrollVariable.upsert({
  where: { employeeId_month: { employeeId, month } },
  update: {},
  create: { employeeId, month },
})

const calculatePayroll = async (employee, month, settings, attendanceSettings = null) => {
  const comp = await getCompensation(employee)
  const variable = await getVariables(employee.id, month)
  const attendanceImpact = await getAttendanceImpact(employee.id, month, attendanceSettings)

  const basic = comp.basicSalary || Math.round(employee.salary || 0)
  const allowances = comp.housingAllowance + comp.transportAllowance + comp.medicalAllowance
  const overtimeRate = variable.overtimeRate || Math.round((basic / 176) * settings.overtimeMultiplier)
  const overtime = Math.round(variable.overtimeHours * overtimeRate)
  const totalUnpaidDays = toFloat(variable.unpaidLeaveDays) + attendanceImpact.attendanceUnpaidDays
  const unpaidLeaveDeduction = Math.round((basic / settings.unpaidLeaveDailyDivisor) * totalUnpaidDays)
  const gross = basic + allowances + overtime + variable.bonus + variable.reimbursements
  const tax = Math.round(Math.max(0, gross - variable.reimbursements) * settings.taxRate)
  const recurringDeductions = comp.recurringDeductions + Math.round(Math.max(0, gross - variable.reimbursements) * settings.standardDeductionRate)
  const oneTimeDeductions = variable.oneTimeDeductions
  const deductions = tax + recurringDeductions + oneTimeDeductions + unpaidLeaveDeduction
  const net = Math.max(0, gross - deductions)

  return {
    currency: settings.currency,
    basic,
    allowances,
    overtime,
    bonus: variable.bonus,
    reimbursements: variable.reimbursements,
    unpaidLeaveDeduction,
    recurringDeductions,
    oneTimeDeductions,
    gross,
    deductions,
    tax,
    net,
    attendanceImpact: {
      ...attendanceImpact,
      manualUnpaidDays: toFloat(variable.unpaidLeaveDays),
      totalUnpaidDays: Number(totalUnpaidDays.toFixed(2)),
      attendanceDeduction: Math.round((basic / settings.unpaidLeaveDailyDivisor) * attendanceImpact.attendanceUnpaidDays),
    },
  }
}

const publishPaidPayslip = async ({ record, user, ip }) => {
  const fullRecord = await prisma.payrollRecord.findUnique({
    where: { id: record.id },
    include: {
      employee: {
        select: { id: true, name: true, email: true, dept: true, role: true, userId: true },
      },
    },
  })
  if (!fullRecord?.employee) return { emailDelivery: null }

  const compensation = await prisma.compensationStructure.findUnique({
    where: { employeeId: fullRecord.employeeId },
  }).catch(() => null)
  const { pdf, filePath, filename } = await savePayslipPdf({
    record: fullRecord,
    employee: fullRecord.employee,
    compensation,
  })

  await prisma.document.create({
    data: {
      employeeId: fullRecord.employeeId,
      name: `${fullRecord.month} Payslip`,
      category: 'Payroll',
      uploadedBy: user.name,
      uploadedOn: today(),
      status: 'Verified',
      filePath,
    },
  })

  if (fullRecord.employee.userId) {
    await createNotification(prisma, {
      type: 'payroll',
      msg: `${fullRecord.month} payslip is now available. Net pay ${fullRecord.currency} ${fullRecord.net.toLocaleString('en-LK')}.`,
      path: '/employee/payroll',
      userIds: [fullRecord.employee.userId],
    })
  }

  let emailDelivery = null
  try {
    emailDelivery = await sendPayslipEmail({
      record: fullRecord,
      employee: fullRecord.employee,
      pdf,
      filename,
    })
  } catch (err) {
    emailDelivery = { sent: false, mode: 'error', message: err.message }
  }

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'PUBLISH_PAYSLIP',
      module: 'Payroll',
      detail: `${fullRecord.month} payslip published for ${fullRecord.employee.name}`,
      ip,
    },
  })

  return { emailDelivery }
}

router.get('/', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { month, employeeId } = req.query
    const where = month ? { month } : {}
    if (employeeId) where.employeeId = employeeId

    const records = await prisma.payrollRecord.findMany({
      where,
      include: { employee: { select: { name: true, dept: true } } },
      orderBy: { employee: { name: 'asc' } },
    })

    const withAttendance = await attachAttendanceImpact(records)
    res.json(withAttendance.map(record => serializeRecord(record)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/settings', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    res.json(await getSettings())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/settings', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const data = {}
    if (req.body.currency !== undefined) data.currency = req.body.currency
    if (req.body.payPeriod !== undefined) data.payPeriod = req.body.payPeriod
    if (req.body.taxRate !== undefined) data.taxRate = toFloat(req.body.taxRate)
    if (req.body.standardDeductionRate !== undefined) data.standardDeductionRate = toFloat(req.body.standardDeductionRate)
    if (req.body.overtimeMultiplier !== undefined) data.overtimeMultiplier = toFloat(req.body.overtimeMultiplier, 1.5)
    if (req.body.unpaidLeaveDailyDivisor !== undefined) data.unpaidLeaveDailyDivisor = toInt(req.body.unpaidLeaveDailyDivisor, 22)

    const settings = await prisma.payrollSetting.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/compensation/:empId', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.empId } })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(await getCompensation(employee))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/compensation/:empId', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.empId } })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })

    const data = {
      basicSalary: toInt(req.body.basicSalary),
      housingAllowance: toInt(req.body.housingAllowance),
      transportAllowance: toInt(req.body.transportAllowance),
      medicalAllowance: toInt(req.body.medicalAllowance),
      recurringDeductions: toInt(req.body.recurringDeductions),
      bankName: req.body.bankName || null,
      bankAccount: req.body.bankAccount || null,
    }
    const comp = await prisma.compensationStructure.upsert({
      where: { employeeId: employee.id },
      update: data,
      create: { employeeId: employee.id, ...data },
    })
    res.json(comp)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/variables/:empId/:month', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    res.json(await getVariables(req.params.empId, req.params.month))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/variables/:empId/:month', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const data = {
      overtimeHours: toFloat(req.body.overtimeHours),
      overtimeRate: toInt(req.body.overtimeRate),
      bonus: toInt(req.body.bonus),
      unpaidLeaveDays: toFloat(req.body.unpaidLeaveDays),
      reimbursements: toInt(req.body.reimbursements),
      oneTimeDeductions: toInt(req.body.oneTimeDeductions),
      notes: req.body.notes || null,
    }
    const variable = await prisma.payrollVariable.upsert({
      where: { employeeId_month: { employeeId: req.params.empId, month: req.params.month } },
      update: data,
      create: { employeeId: req.params.empId, month: req.params.month, ...data },
    })
    res.json(variable)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/monthly-trend', auth, async (req, res) => {
  try {
    const records = await prisma.payrollRecord.findMany()
    const byMonth = new Map()
    for (const record of records) {
      if (!byMonth.has(record.month)) byMonth.set(record.month, { month: record.month, gross: 0, net: 0, tax: 0 })
      const row = byMonth.get(record.month)
      row.gross += record.gross
      row.net += record.net
      row.tax += record.tax
    }
    res.json(Array.from(byMonth.values()))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/employee/:empId', auth, async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      const myEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!myEmp || myEmp.id !== req.params.empId) return res.status(403).json({ error: 'Forbidden' })
    }

    const settings = await getSettings()
    const records = await prisma.payrollRecord.findMany({
      where: { employeeId: req.params.empId, status: 'Paid' },
    })
    const withAttendance = await attachAttendanceImpact(records)

    res.json(withAttendance
      .map(record => serializeRecord(record, settings.currency))
      .sort((a, b) => monthIndex(b.month) - monthIndex(a.month)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/run', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { month } = req.body
    if (!month) return res.status(400).json({ error: 'Month is required (e.g. "June 2026")' })

    const settings = await getSettings()
    const attendanceSettings = await loadAttendanceSettings(prisma)
    const employees = await prisma.employee.findMany({ where: { status: 'Active' } })

    const records = []
    const skipped = []
    for (const emp of employees) {
      const existing = await prisma.payrollRecord.findUnique({
        where: { employeeId_month: { employeeId: emp.id, month } },
      })
      if (existing?.status === 'Paid') {
        skipped.push({ employeeId: emp.id, reason: 'Already paid' })
        continue
      }
      const calculated = await calculatePayroll(emp, month, settings, attendanceSettings)
      const { attendanceImpact, ...payrollData } = calculated
      const record = await prisma.payrollRecord.upsert({
        where: { employeeId_month: { employeeId: emp.id, month } },
        update: { ...payrollData, status: 'Draft', approvedBy: null, approvedOn: null, paidOn: null },
        create: { employeeId: emp.id, month, ...payrollData, status: 'Draft' },
        include: { employee: { select: { name: true, dept: true } } },
      })
      records.push({ ...record, attendanceImpact })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DRAFT_PAYROLL', module: 'Payroll', detail: `Drafted payroll for ${month}`, ip: req.ip },
    })

    res.json({
      message: `Draft payroll prepared for ${month}`,
      count: records.length,
      skipped,
      records: records.map(record => serializeRecord(record)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.payrollRecord.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Payroll record not found' })
    if (existing.status === 'Paid') return res.status(400).json({ error: 'Paid payroll records cannot be edited' })

    const allowed = ['basic','allowances','overtime','bonus','reimbursements','unpaidLeaveDeduction','recurringDeductions','oneTimeDeductions','tax']
    const data = {}
    allowed.forEach(key => {
      if (req.body[key] !== undefined) data[key] = toInt(req.body[key])
    })
    if (Object.keys(data).length) {
      const next = { ...existing, ...data }
      const gross = next.basic + next.allowances + next.overtime + next.bonus + next.reimbursements
      const deductions = next.tax + next.unpaidLeaveDeduction + next.recurringDeductions + next.oneTimeDeductions
      data.gross = gross
      data.deductions = deductions
      data.net = Math.max(0, gross - deductions)
      data.status = 'Draft'
      data.approvedBy = null
      data.approvedOn = null
    }

    const record = await prisma.payrollRecord.update({
      where: { id: req.params.id },
      data,
      include: { employee: { select: { name: true, dept: true } } },
    })
    res.json(serializeRecord(record))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/approve', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.payrollRecord.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Payroll record not found' })
    if (existing.status === 'Paid') return res.status(400).json({ error: 'Paid payroll records cannot be approved again' })
    const record = await prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: { status: 'Approved', approvedBy: req.user.name, approvedOn: today() },
      include: { employee: { select: { name: true, dept: true } } },
    })
    res.json(serializeRecord(record))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id/pay', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.payrollRecord.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Payroll record not found' })
    if (existing.status !== 'Approved') return res.status(400).json({ error: 'Only approved payroll records can be marked paid' })
    const record = await prisma.payrollRecord.update({
      where: { id: req.params.id },
      data: { status: 'Paid', paidOn: today() },
      include: { employee: { select: { name: true, dept: true, userId: true } } },
    })

    const publish = await publishPaidPayslip({ record, user: req.user, ip: req.ip })

    res.json({
      ...serializeRecord(record),
      emailDelivery: publish.emailDelivery,
      message: `${record.employee.name} marked paid. Payslip notification and email prepared.`,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/approve-drafts', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { month } = req.body
    if (!month) return res.status(400).json({ error: 'Month is required' })

    const drafts = await prisma.payrollRecord.findMany({
      where: { month, status: 'Draft' },
      include: { employee: { select: { name: true, dept: true } } },
      orderBy: { employee: { name: 'asc' } },
    })
    if (!drafts.length) {
      return res.status(400).json({ error: `No draft payroll records found for ${month}` })
    }

    const approved = []
    for (const row of drafts) {
      const record = await prisma.payrollRecord.update({
        where: { id: row.id },
        data: { status: 'Approved', approvedBy: req.user.name, approvedOn: today() },
        include: { employee: { select: { name: true, dept: true } } },
      })
      approved.push(record)
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'APPROVE_DRAFT_PAYROLL',
        module: 'Payroll',
        detail: `Approved ${approved.length} draft payroll records for ${month}`,
        ip: req.ip,
      },
    })

    res.json({
      message: `${approved.length} draft payroll records approved for ${month}.`,
      count: approved.length,
      records: approved.map(record => serializeRecord(record)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/pay-approved', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { month } = req.body
    if (!month) return res.status(400).json({ error: 'Month is required' })

    const approved = await prisma.payrollRecord.findMany({
      where: { month, status: 'Approved' },
      include: { employee: { select: { name: true, dept: true } } },
      orderBy: { employee: { name: 'asc' } },
    })
    if (!approved.length) {
      return res.status(400).json({ error: `No approved payroll records found for ${month}` })
    }

    const paid = []
    const deliveries = []
    for (const row of approved) {
      const record = await prisma.payrollRecord.update({
        where: { id: row.id },
        data: { status: 'Paid', paidOn: today() },
        include: { employee: { select: { name: true, dept: true } } },
      })
      const publish = await publishPaidPayslip({ record, user: req.user, ip: req.ip })
      paid.push(record)
      deliveries.push({ id: record.id, employee: record.employee.name, emailDelivery: publish.emailDelivery })
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PAY_APPROVED_PAYROLL',
        module: 'Payroll',
        detail: `Marked ${paid.length} approved payroll records paid for ${month}`,
        ip: req.ip,
      },
    })

    res.json({
      message: `${paid.length} approved payroll records marked paid for ${month}. Payslip notifications and emails prepared.`,
      count: paid.length,
      deliveries,
      records: paid.map(record => serializeRecord(record)),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
