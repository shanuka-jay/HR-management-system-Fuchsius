const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { evaluateAttendance, loadAttendanceSettings } = require('../utils/attendanceRules')

const prisma = new PrismaClient()

const sumBy = (rows, key) => rows.reduce((total, row) => total + (row[key] || 0), 0)

const payrollTrend = async () => {
  const records = await prisma.payrollRecord.findMany()
  const byMonth = new Map()
  records.forEach(record => {
    if (!byMonth.has(record.month)) byMonth.set(record.month, { month: record.month, gross: 0, net: 0, tax: 0 })
    const row = byMonth.get(record.month)
    row.gross += record.gross
    row.net += record.net
    row.tax += record.tax
  })
  return Array.from(byMonth.values())
}

const attendanceTrend = async () => {
  const records = await prisma.attendance.findMany()
  const settings = await loadAttendanceSettings(prisma)
  const byMonth = new Map()
  records.forEach(record => {
    const month = record.date?.slice(0, 7) || 'Unknown'
    if (!byMonth.has(month)) byMonth.set(month, {
      month,
      present: 0,
      absent: 0,
      late: 0,
      completed: 0,
      earlyLeave: 0,
      lateMinutes: 0,
    })
    const row = byMonth.get(month)
    const evaluation = evaluateAttendance(record, settings)
    if (evaluation.status === 'Late') row.late += 1
    else if (evaluation.status === 'Absent') row.absent += 1
    else row.present += 1
    if (evaluation.completedShift) row.completed += 1
    if (evaluation.earlyLeaveMinutes > 0) row.earlyLeave += 1
    row.lateMinutes += evaluation.lateMinutes
  })
  return Array.from(byMonth.values())
}

router.get('/summary', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const [employees, departments, leaves, candidates, reviews, payroll] = await Promise.all([
      prisma.employee.findMany(),
      prisma.department.findMany(),
      prisma.leaveRequest.findMany(),
      prisma.candidate.findMany(),
      prisma.performanceReview.findMany(),
      payrollTrend(),
    ])

    const latestPayroll = payroll[payroll.length - 1] || { gross: 0, net: 0, tax: 0 }
    const rated = reviews.filter(r => r.rating)
    res.json({
      employees: {
        total: employees.length,
        active: employees.filter(e => e.status === 'Active').length,
        inactive: employees.filter(e => e.status === 'Inactive').length,
        onLeave: employees.filter(e => e.status === 'On Leave').length,
      },
      departments: departments.length,
      leaves: {
        pending: leaves.filter(l => l.status === 'Pending').length,
        approved: leaves.filter(l => l.status === 'Approved').length,
        rejected: leaves.filter(l => l.status === 'Rejected').length,
      },
      recruitment: {
        candidates: candidates.length,
        hired: candidates.filter(c => c.status === 'Hired').length,
      },
      performance: {
        reviews: reviews.length,
        completed: reviews.filter(r => r.status === 'Completed').length,
        averageRating: rated.length ? Number((sumBy(rated, 'rating') / rated.length).toFixed(1)) : null,
      },
      payroll: latestPayroll,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/analytics', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const [employees, departments, payroll, attendance] = await Promise.all([
      prisma.employee.findMany(),
      prisma.department.findMany(),
      payrollTrend(),
      attendanceTrend(),
    ])
    const deptHeadcount = departments.map(d => ({
      name: d.name,
      count: employees.filter(e => e.dept === d.name || (d.name === 'Human Resources' && e.dept === 'HR')).length,
    }))
    const status = [
      { name: 'Active', value: employees.filter(e => e.status === 'Active').length },
      { name: 'On Leave', value: employees.filter(e => e.status === 'On Leave').length },
      { name: 'Inactive', value: employees.filter(e => e.status === 'Inactive').length },
    ]
    res.json({ deptHeadcount, status, payroll, attendance })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/export/:type', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { type } = req.params
    const { department, employeeId, status, month, leaveType, dateFrom, dateTo, cycle, ratingMin, ratingMax } = req.query
    if (type === 'employees') {
      const where = {}
      if (department && department !== 'All') where.dept = String(department)
      if (status && status !== 'All') where.status = String(status)
      if (employeeId && employeeId !== 'All') where.id = String(employeeId)
      const employees = await prisma.employee.findMany({ where, orderBy: { name: 'asc' } })
      return res.json(employees.map(e => ({
        ID: e.id, Employee: e.name, Department: e.dept, Role: e.role,
        Status: e.status, Manager: e.manager || '', MonthlySalary: e.salary,
      })))
    }
    if (type === 'payroll') {
      const where = {}
      if (month && month !== 'All') where.month = String(month)
      if (status && status !== 'All') where.status = String(status)
      if (employeeId && employeeId !== 'All') where.employeeId = String(employeeId)
      const records = await prisma.payrollRecord.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } })
      const rows = records.map(p => ({
        Employee: p.employee.name, Department: p.employee.dept, Month: p.month,
        Gross: p.gross, Deductions: p.deductions, Net: p.net, Status: p.status,
      }))
      const filtered = department && department !== 'All'
        ? rows.filter(row => row.Department === department)
        : rows
      return res.json(filtered)
    }
    if (type === 'attendance') {
      const { shift } = req.query
      const where = {}
      if (dateFrom || dateTo) {
        where.date = {}
        if (dateFrom) where.date.gte = String(dateFrom)
        if (dateTo) where.date.lte = String(dateTo)
      }
      if (employeeId && employeeId !== 'All') where.employeeId = String(employeeId)
      const records = await prisma.attendance.findMany({ where, include: { employee: true }, orderBy: [{ date: 'desc' }, { employee: { name: 'asc' } }] })
      const settings = await loadAttendanceSettings(prisma)
      const rows = records.map(a => {
        const evaluation = evaluateAttendance(a, settings)
        return {
          Employee: a.employee.name,
          Department: a.employee.dept,
          Date: a.date,
          Shift: evaluation.shift,
          ShiftStart: evaluation.shiftStart,
          ShiftEnd: evaluation.shiftEnd,
          CheckIn: a.checkIn || '',
          CheckOut: a.checkOut || '',
          Hours: a.hours,
          LateMinutes: evaluation.lateMinutes,
          EarlyLeaveMinutes: evaluation.earlyLeaveMinutes,
          ShiftResult: evaluation.shiftResult,
          Status: evaluation.status,
        }
      })
      let filtered = shift && shift !== 'All' ? rows.filter(row => row.Shift === shift) : rows
      if (department && department !== 'All') filtered = filtered.filter(row => row.Department === department)
      if (status && status !== 'All') filtered = filtered.filter(row => row.Status === status)
      return res.json(filtered)
    }
    if (type === 'leave') {
      const where = {}
      if (employeeId && employeeId !== 'All') where.employeeId = String(employeeId)
      if (leaveType && leaveType !== 'All') where.type = String(leaveType)
      if (status && status !== 'All') where.status = String(status)
      if (dateFrom || dateTo) {
        where.start = {}
        if (dateFrom) where.start.gte = String(dateFrom)
        if (dateTo) where.start.lte = String(dateTo)
      }
      const leaves = await prisma.leaveRequest.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } })
      const rows = leaves.map(l => ({
        Employee: l.employee.name, Department: l.employee.dept, Type: l.type, From: l.start, To: l.end,
        Days: l.days, Status: l.status, DecisionNote: l.decisionNote || '',
      }))
      const filtered = department && department !== 'All'
        ? rows.filter(row => row.Department === department)
        : rows
      return res.json(filtered)
    }
    if (type === 'performance') {
      const where = {}
      if (employeeId && employeeId !== 'All') where.employeeId = String(employeeId)
      if (cycle && cycle !== 'All') where.period = String(cycle)
      if (status && status !== 'All') where.status = String(status)
      if (ratingMin || ratingMax) {
        where.rating = {}
        if (ratingMin) where.rating.gte = Number(ratingMin)
        if (ratingMax) where.rating.lte = Number(ratingMax)
      }
      const reviews = await prisma.performanceReview.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } })
      const rows = reviews.map(r => ({
        Employee: r.employee.name, Period: r.period, Reviewer: r.reviewer || '',
        Goals: `${r.completed}/${r.goals}`, Rating: r.rating || 'Pending',
        Status: r.status, Recommendation: r.recommendation || '', Department: r.employee.dept,
      }))
      const filtered = department && department !== 'All'
        ? rows.filter(row => row.Department === department)
        : rows
      return res.json(filtered)
    }
    res.status(400).json({ error: 'Unsupported report type' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
