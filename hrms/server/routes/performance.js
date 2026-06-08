const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { createNotification, getDirectManagerUserId } = require('../utils/notificationTargets')

const prisma = new PrismaClient()

const canManageEmployeeGoal = async (req, employeeId) => {
  if (req.user.role === 'admin' || req.user.role === 'hr') return true
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return false
  if (req.user.role === 'employee') return employee.userId === req.user.id
  if (req.user.role === 'manager') {
    const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
    return (managerEmp && employee.managerId === managerEmp.id) || employee.manager === req.user.name
  }
  return false
}

const canManageReview = async (req, review) => {
  if (req.user.role === 'admin' || req.user.role === 'hr') return true
  if (req.user.role !== 'manager') return false
  const managerEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
  return (managerEmp && review.employee.managerId === managerEmp.id) || review.employee.manager === req.user.name
}

const serializeReview = (r) => ({
  id:        r.id,
  employee:  r.employee.name,
  empId:     r.employeeId,
  period:    r.period,
  rating:    r.rating,
  goals:     r.goals,
  completed: r.completed,
  status:    r.status,
  reviewer:  r.reviewer,
  selfReview: r.selfReview,
  managerFeedback: r.managerFeedback,
  improvementAreas: r.improvementAreas,
  recommendation: r.recommendation,
  hrCalibration: r.hrCalibration,
  calibratedBy: r.calibratedBy,
  calibratedOn: r.calibratedOn,
})

// GET /api/performance/reviews
router.get('/reviews', auth, async (req, res) => {
  try {
    const { employeeId } = req.query
    const where = {}
    if (employeeId) where.employeeId = employeeId

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

    const reviews = await prisma.performanceReview.findMany({
      where,
      include: { employee: { select: { name: true, dept: true } } },
      orderBy: { createdAt: 'desc' },
    })

    res.json(reviews.map(serializeReview))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/performance/reviews/:id
router.patch('/reviews/:id', auth, requireRole('admin', 'hr', 'manager'), async (req, res) => {
  try {
    const existing = await prisma.performanceReview.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { manager: true, managerId: true, name: true } } },
    })
    if (!existing) return res.status(404).json({ error: 'Review not found' })
    if (!(await canManageReview(req, existing))) {
      return res.status(403).json({ error: 'Managers can only rate direct reports' })
    }

    const { rating, status, completed, managerFeedback, improvementAreas, recommendation } = req.body
    const data = {}
    if (rating !== undefined) data.rating = parseFloat(rating)
    if (status !== undefined) data.status = status
    if (completed !== undefined) data.completed = parseInt(completed, 10) || 0
    if (managerFeedback !== undefined) data.managerFeedback = managerFeedback || null
    if (improvementAreas !== undefined) data.improvementAreas = improvementAreas || null
    if (recommendation !== undefined) data.recommendation = recommendation || null
    if (rating !== undefined && status === undefined) data.status = req.user.role === 'manager' ? 'Manager Reviewed' : 'Completed'
    data.reviewer = req.user.name

    const review = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data,
      include: { employee: { select: { name: true, userId: true, manager: true, managerId: true } } },
    })

    if (req.user.role === 'manager' || data.status === 'Manager Reviewed') {
      await createNotification(prisma, {
        type: 'review',
        msg: `${review.period} manager review was submitted`,
        path: '/employee/performance',
        userIds: [review.employee.userId],
      })
    }

    res.json(serializeReview(review))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/performance/reviews/:id/self-review
router.patch('/reviews/:id/self-review', auth, requireRole('employee'), async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
    if (!emp) return res.status(404).json({ error: 'Employee record not found' })
    const existing = await prisma.performanceReview.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { name: true } } },
    })
    if (!existing || existing.employeeId !== emp.id) return res.status(403).json({ error: 'Forbidden' })
    const review = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data: { selfReview: req.body.selfReview || null, status: 'Self Submitted' },
      include: { employee: { select: { name: true, manager: true, managerId: true } } },
    })
    const managerUserId = await getDirectManagerUserId(prisma, review.employee)
    if (managerUserId) {
      await createNotification(prisma, {
        type: 'review',
        msg: `${review.employee.name} submitted a self-review for ${review.period}`,
        path: '/manager/performance',
        userIds: [managerUserId],
      })
    }
    res.json(serializeReview(review))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/performance/reviews/:id/calibrate
router.patch('/reviews/:id/calibrate', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const data = {
      hrCalibration: req.body.hrCalibration || null,
      calibratedBy: req.user.name,
      calibratedOn: new Date().toISOString().slice(0, 10),
      status: req.body.publish ? 'Completed' : 'Calibrated',
    }
    if (req.body.rating !== undefined) data.rating = parseFloat(req.body.rating)
    const review = await prisma.performanceReview.update({
      where: { id: req.params.id },
      data,
      include: { employee: { select: { name: true, userId: true } } },
    })
    if (req.body.publish && review.employee.userId) {
      await createNotification(prisma, {
        type: 'review',
        msg: `${review.period} performance review is complete`,
        path: '/employee/performance',
        userIds: [review.employee.userId],
      })
    }
    res.json(serializeReview(review))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/performance/cycles
router.get('/cycles', auth, async (req, res) => {
  try {
    const cycles = await prisma.performanceCycle.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(cycles)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/performance/cycles
router.post('/cycles', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { name, type, dept, startDate, endDate } = req.body
    const cycle = await prisma.performanceCycle.create({
      data: { name, type: type || 'Quarterly Review', dept: dept || 'All Departments', startDate, endDate, status: 'Draft' },
    })

    await createNotification(prisma, {
      type: 'review',
      msg: `${name} performance cycle was created`,
      path: '/hr/performance',
      audience: ['hr', 'admin'],
      dept: dept && dept !== 'All Departments' ? dept : null,
    })

    res.status(201).json(cycle)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/performance/cycles/:id/launch
router.patch('/cycles/:id/launch', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const cycle = await prisma.performanceCycle.update({
      where: { id: req.params.id },
      data:  { status: 'In Progress' },
    })

    const employeeWhere = cycle.dept && cycle.dept !== 'All Departments'
      ? { status: 'Active', dept: cycle.dept }
      : { status: 'Active' }
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true },
    })
    for (const employee of employees) {
      await prisma.performanceReview.upsert({
        where: { employeeId_period: { employeeId: employee.id, period: cycle.name } },
        update: {},
        create: {
          employeeId: employee.id,
          period: cycle.name,
          goals: 0,
          completed: 0,
          status: 'In Progress',
        },
      })
    }

    await createNotification(prisma, {
      type: 'review',
      msg: `${cycle.name} is now open for reviews`,
      path: '/employee/performance',
      audience: ['employee', 'manager', 'hr', 'admin'],
      dept: cycle.dept && cycle.dept !== 'All Departments' ? cycle.dept : null,
    })

    res.json({ ...cycle, createdReviews: employees.length })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/cycles/:id/complete', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.performanceCycle.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Cycle not found' })
    const reviews = await prisma.performanceReview.findMany({ where: { period: existing.name } })
    const unfinished = reviews.filter(review => review.status !== 'Completed')
    if (!reviews.length) {
      return res.status(400).json({ error: 'Launch the cycle before completing it.' })
    }
    if (unfinished.length) {
      return res.status(400).json({ error: `Cannot complete cycle yet. ${unfinished.length} review(s) are not published/completed.` })
    }
    const cycle = await prisma.performanceCycle.update({
      where: { id: req.params.id },
      data: { status: 'Completed' },
    })
    await createNotification(prisma, {
      type: 'review',
      msg: `${cycle.name} was completed`,
      path: '/employee/performance',
      audience: ['employee', 'manager', 'hr', 'admin'],
      dept: cycle.dept && cycle.dept !== 'All Departments' ? cycle.dept : null,
    })
    res.json(cycle)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/performance/goals/:empId
router.get('/goals/:empId', auth, async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!emp || emp.id !== req.params.empId) return res.status(403).json({ error: 'Forbidden' })
    } else if (req.user.role === 'manager') {
      const allowed = await canManageEmployeeGoal(req, req.params.empId)
      if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    }

    const goals = await prisma.goal.findMany({
      where: { employeeId: req.params.empId },
      orderBy: { createdAt: 'desc' },
    })
    res.json(goals)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/performance/goals
router.post('/goals', auth, async (req, res) => {
  try {
    const { employeeId, title, due, progress, status } = req.body
    if (!employeeId || !title || !due) return res.status(400).json({ error: 'Employee, title and due date are required' })
    const allowed = await canManageEmployeeGoal(req, employeeId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    const goal = await prisma.goal.create({
      data: { employeeId, title, due, progress: progress || 0, status: status || 'On Track' },
    })
    await syncReviewGoalCounts(employeeId)
    res.status(201).json(goal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/performance/goals/:id
router.patch('/goals/:id', auth, async (req, res) => {
  try {
    const { title, due, progress, status } = req.body
    const existing = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Goal not found' })
    const allowed = await canManageEmployeeGoal(req, existing.employeeId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    const data = {}
    if (title !== undefined) data.title = title
    if (due !== undefined) data.due = due
    if (progress !== undefined) data.progress = Math.max(0, Math.min(100, parseInt(progress, 10) || 0))
    if (status !== undefined) data.status = status
    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data,
    })
    await syncReviewGoalCounts(existing.employeeId)
    res.json(goal)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/goals/:id', auth, async (req, res) => {
  try {
    const existing = await prisma.goal.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Goal not found' })
    const allowed = await canManageEmployeeGoal(req, existing.employeeId)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    await prisma.goal.delete({ where: { id: req.params.id } })
    await syncReviewGoalCounts(existing.employeeId)
    res.json({ message: 'Goal deleted successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function syncReviewGoalCounts(employeeId) {
  const goals = await prisma.goal.findMany({ where: { employeeId } })
  const total = goals.length
  const completed = goals.filter(goal => goal.status === 'Completed' || Number(goal.progress) >= 100).length
  await prisma.performanceReview.updateMany({
    where: { employeeId, status: { not: 'Completed' } },
    data: { goals: total, completed },
  })
}

module.exports = router
