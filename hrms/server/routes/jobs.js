const router = require('express').Router()
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

// GET /api/jobs
router.get('/', auth, async (req, res) => {
  try {
    const { status, includeArchived } = req.query
    const where = status
      ? { status }
      : includeArchived === 'true'
        ? {}
        : { status: { not: 'Archived' } }
    const jobs = await prisma.jobOpening.findMany({
      where,
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(jobs.map(j => ({ ...j, applicants: j._count.candidates || j.applicants })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/jobs
router.post('/', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { title, dept, type, location, description, minSalary, maxSalary } = req.body
    if (!title) return res.status(400).json({ error: 'Job title is required' })

    const job = await prisma.jobOpening.create({
      data: {
        title,
        dept:        dept       || 'Engineering',
        type:        type       || 'Full-time',
        location:    location   || 'Remote',
        description: description || null,
        minSalary:   minSalary ? parseInt(minSalary, 10) : null,
        maxSalary:   maxSalary ? parseInt(maxSalary, 10) : null,
        posted:      new Date().toISOString().slice(0, 10),
        status:      'Active',
      },
    })

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'POST_JOB', module: 'Recruitment', detail: `Posted job: ${title}`, ip: req.ip },
    })

    res.status(201).json(job)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/jobs/:id/close
router.patch('/:id/close', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const job = await prisma.jobOpening.update({ where: { id: req.params.id }, data: { status: 'Closed' } })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/jobs/:id/reopen
router.patch('/:id/reopen', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const job = await prisma.jobOpening.update({ where: { id: req.params.id }, data: { status: 'Active' } })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/jobs/:id
router.delete('/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.jobOpening.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { candidates: true } } },
    })

    if (!existing) return res.status(404).json({ error: 'Job not found' })

    if (existing._count.candidates > 0) {
      const job = await prisma.jobOpening.update({
        where: { id: req.params.id },
        data: { status: 'Archived' },
      })

      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'ARCHIVE_JOB',
          module: 'Recruitment',
          detail: `Archived job: ${existing.title}; preserved ${existing._count.candidates} candidate(s)`,
          ip: req.ip,
        },
      })

      return res.json({
        message: 'Job archived; existing candidates were preserved.',
        archived: true,
        deleted: false,
        job,
      })
    }

    await prisma.jobOpening.delete({ where: { id: req.params.id } })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_JOB',
        module: 'Recruitment',
        detail: `Deleted job: ${existing.title}`,
        ip: req.ip,
      },
    })

    res.json({
      message: 'Job deleted.',
      archived: false,
      deleted: true,
      job: { ...existing, status: 'Deleted' },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
