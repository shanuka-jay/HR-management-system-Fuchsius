const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

// GET /api/departments
router.get('/', auth, async (req, res) => {
  try {
    const depts = await prisma.department.findMany({ orderBy: { name: 'asc' } })

    // Attach employee count dynamically
    const withCount = await Promise.all(depts.map(async d => {
      const count = await prisma.employee.count({ where: { dept: d.name, status: { not: 'Inactive' } } })
      return { ...d, employees: count }
    }))

    res.json(withCount)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/departments
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, head, budget } = req.body
    const dept = await prisma.department.create({
      data: { name, head: head || null, budget: budget ? parseInt(budget, 10) : 0 },
    })
    res.status(201).json(dept)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Department already exists' })
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/departments/:id
router.put('/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { name, head, budget } = req.body
    const data = {}
    if (name   !== undefined) data.name   = name
    if (head   !== undefined) data.head   = head
    if (budget !== undefined) data.budget = parseInt(budget, 10)
    const dept = await prisma.department.update({ where: { id: req.params.id }, data })
    res.json(dept)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
