const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

router.get('/status', auth, requireRole('admin'), async (req, res) => {
  try {
    res.json({
      googleSsoConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
      smtpConfigured: Boolean(process.env.SMTP_HOST),
      smtpHost: process.env.SMTP_HOST || '',
      mailFrom: process.env.MAIL_FROM || process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || '',
      emailMode: process.env.SMTP_HOST ? 'smtp' : 'outbox',
      appUrl: process.env.APP_URL || 'http://localhost:3000/login',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/settings
router.get('/', auth, async (req, res) => {
  try {
    const rows = await prisma.setting.findMany()
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/settings
router.put('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const updates = req.body // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }
    const rows = await prisma.setting.findMany()
    const settings = {}
    rows.forEach(r => { settings[r.key] = r.value })
    res.json(settings)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
