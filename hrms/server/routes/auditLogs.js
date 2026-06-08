const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

// GET /api/audit-logs
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const page  = parseInt(req.query.page  || '1',  10)
    const limit = parseInt(req.query.limit || '50', 10)
    const skip  = (page - 1) * limit

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: { user: { select: { name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.auditLog.count(),
    ])

    res.json({
      logs: logs.map(l => ({
        id:        l.id,
        user:      l.user?.name || 'System',
        role:      l.user?.role || '-',
        action:    l.action,
        module:    l.module,
        detail:    l.detail,
        ip:        l.ip,
        time:      l.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/audit-logs/old
router.delete('/old', auth, requireRole('admin'), async (req, res) => {
  try {
    const retentionMonths = parseInt(req.body.retentionMonths || '84', 10)
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - Math.max(1, retentionMonths))

    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PURGE_OLD_LOGS',
        module: 'Audit',
        detail: `Purged ${result.count} audit log(s) older than ${retentionMonths} months`,
        ip: req.ip,
      },
    })

    res.json({ purged: result.count, retentionMonths })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
