const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

const personalWorkflowTypes = new Set(['leave', 'attendance', 'document', 'payroll', 'employee'])

const canSeeLegacyPersonalNotification = (notification, user, context, audience) => {
  if (!personalWorkflowTypes.has(notification.type)) return null
  const hasExplicitUsers = notification.userIds.split(',').map(a => a.trim()).filter(Boolean).length > 0
  if (hasExplicitUsers) return null
  if (!audience.includes(user.role)) return null

  if (user.role === 'employee') {
    return notification.msg.includes(user.name)
  }
  if (user.role === 'manager') {
    return (context.directReportNames || []).some(name => notification.msg.includes(name))
  }
  return null
}

const canSeeNotification = (notification, user, context = {}) => {
  const audience = notification.audience.split(',').map(a => a.trim()).filter(Boolean)
  const userIds = notification.userIds.split(',').map(a => a.trim()).filter(Boolean)
  const userMatch = userIds.includes(user.id)
  if (userMatch) return true

  if (notification.createdAt < user.createdAt) return false

  const roleMatch = audience.includes(user.role)
  const deptMatch = notification.dept && user.dept === notification.dept
  if (notification.dept && !['admin', 'hr'].includes(user.role)) return Boolean(deptMatch)
  const legacyPersonalMatch = canSeeLegacyPersonalNotification(notification, user, context, audience)
  if (legacyPersonalMatch !== null) return legacyPersonalMatch
  return deptMatch || roleMatch
}

const getNotificationContext = async (user) => {
  if (user.role !== 'manager') return {}
  const managerEmp = await prisma.employee.findUnique({ where: { userId: user.id } })
  if (!managerEmp) return { directReportNames: [] }
  const reports = await prisma.employee.findMany({
    where: {
      OR: [
        { managerId: managerEmp.id },
        { manager: user.name },
      ],
    },
    select: { name: true },
  })
  return { directReportNames: reports.map(r => r.name) }
}

const pathForUser = (notification, user) => {
  if (notification.type === 'review' && notification.path === '/hr/performance') {
    if (user.role === 'employee') return '/employee/performance'
    if (user.role === 'manager') return '/manager/performance'
  }
  return notification.path
}

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const role = req.user.role
    const all  = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    const context = await getNotificationContext(req.user)

    const filtered = all
      .filter(n => canSeeNotification(n, req.user, context))
      .map(n => ({
        id:        n.id,
        type:      n.type,
        msg:       n.msg,
        path:      pathForUser(n, req.user),
        time:      n.createdAt.toISOString(),
        read:      n.readBy.split(',').filter(Boolean).includes(req.user.id),
        audience:  n.audience.split(',').filter(Boolean),
        userIds:   n.userIds.split(',').filter(Boolean),
        dept:      n.dept,
      }))

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications
router.post('/', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { type = 'system', msg, path = '/', audience = 'admin,hr,manager,employee', userIds = '', dept = null } = req.body
    if (!msg || !String(msg).trim()) return res.status(400).json({ error: 'Notification message is required' })
    const notification = await prisma.notification.create({
      data: {
        type,
        msg: String(msg).trim(),
        path,
        audience: Array.isArray(audience) ? audience.join(',') : audience,
        userIds: Array.isArray(userIds) ? userIds.join(',') : userIds,
        dept: dept || null,
      },
    })
    res.status(201).json(notification)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!n) return res.status(404).json({ error: 'Not found' })

    const readers = n.readBy.split(',').filter(Boolean)
    if (!readers.includes(req.user.id)) readers.push(req.user.id)

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data:  { readBy: readers.join(',') },
    })
    res.json({ id: updated.id, read: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/notifications/read-all
router.patch('/read-all', auth, async (req, res) => {
  try {
    const all  = await prisma.notification.findMany({ where: {} })
    const context = await getNotificationContext(req.user)
    const relevant = all.filter(n => canSeeNotification(n, req.user, context))

    for (const n of relevant) {
      const readers = n.readBy.split(',').filter(Boolean)
      if (!readers.includes(req.user.id)) {
        readers.push(req.user.id)
        await prisma.notification.update({ where: { id: n.id }, data: { readBy: readers.join(',') } })
      }
    }

    res.json({ message: 'All notifications marked as read' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
