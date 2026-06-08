const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth } = require('../middleware/auth')

const prisma = new PrismaClient()

// GET /api/holidays
router.get('/', auth, async (req, res) => {
  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const where = req.query.all === 'true' ? {} : { date: { gte: today } }
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } })
    res.json(holidays)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
