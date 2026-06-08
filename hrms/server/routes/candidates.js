const router = require('express').Router()
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { createNotification, getDirectManagerUserId } = require('../utils/notificationTargets')

const prisma = new PrismaClient()

const getPasswordMinLength = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: 'password_min_length' } })
  return parseInt(setting?.value || '8', 10) || 8
}

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || 'Employee',
  }
}

const nextEmployeeId = async (tx) => {
  const all = await tx.employee.findMany({ select: { id: true } })
  const maxNum = all.reduce((max, e) => {
    const n = parseInt(String(e.id).replace('E', ''), 10)
    return n > max ? n : max
  }, 0)
  return `E${String(maxNum + 1).padStart(3, '0')}`
}

const resolveManager = async (tx, managerName) => {
  if (!managerName) return null
  return tx.employee.findFirst({
    where: {
      status: 'Active',
      OR: [{ id: managerName }, { name: managerName }],
    },
    select: { id: true, name: true },
  })
}

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'resumes')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '_')
    cb(null, `${Date.now()}-${base}${ext}`)
  },
})

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!['.pdf', '.doc', '.docx'].includes(ext)) return cb(new Error('Only PDF and Word resumes are allowed'))
    cb(null, true)
  },
})

// GET /api/candidates
router.get('/', auth, async (req, res) => {
  try {
    const { jobId, status } = req.query
    const where = {}
    if (jobId)  where.jobId  = jobId
    if (status) where.status = status

    const candidates = await prisma.candidate.findMany({
      where,
      include: { job: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    })

    res.json(candidates.map(c => ({
      id:      c.id,
      name:    c.name,
      job:     c.job.title,
      jobId:   c.jobId,
      stage:   c.stage,
      status:  c.status,
      applied: c.applied,
      rating:  c.rating,
      resumeUrl: c.resumeUrl,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      interviewNotes: c.interviewNotes,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/candidates
router.post('/', auth, requireRole('admin', 'hr'), resumeUpload.single('resume'), async (req, res) => {
  try {
    const { name, email, phone, jobId, stage = 'Screening', rating = 3, notes, interviewNotes } = req.body
    if (!name || !jobId) return res.status(400).json({ error: 'Candidate name and job are required' })

    const resumeUrl = req.file ? `/uploads/resumes/${req.file.filename}` : null
    const candidate = await prisma.$transaction(async (tx) => {
      const created = await tx.candidate.create({
        data: {
          name,
          email: email || null,
          phone: phone || null,
          jobId,
          stage,
          status: stage === 'Hired' ? 'Hired' : 'In Progress',
          applied: new Date().toISOString().slice(0, 10),
          rating: parseInt(rating, 10) || 3,
          notes: notes || null,
          interviewNotes: interviewNotes || null,
          resumeUrl,
        },
        include: { job: { select: { title: true } } },
      })
      await tx.jobOpening.update({
        where: { id: jobId },
        data: { applicants: { increment: 1 } },
      })
      return created
    })

    res.status(201).json({
      id: candidate.id,
      name: candidate.name,
      job: candidate.job.title,
      jobId: candidate.jobId,
      stage: candidate.stage,
      status: candidate.status,
      applied: candidate.applied,
      rating: candidate.rating,
      resumeUrl: candidate.resumeUrl,
      email: candidate.email,
      phone: candidate.phone,
      notes: candidate.notes,
      interviewNotes: candidate.interviewNotes,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/candidates/:id
router.put('/:id', auth, requireRole('admin', 'hr'), resumeUpload.single('resume'), async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'jobId', 'stage', 'status', 'rating', 'notes', 'interviewNotes']
    const data = {}
    allowed.forEach(key => {
      if (req.body[key] !== undefined) data[key] = req.body[key] || null
    })
    if (data.rating !== undefined) data.rating = parseInt(data.rating, 10) || 3
    if (data.stage && !data.status) {
      data.status = data.stage === 'Hired' ? 'Hired' : data.stage === 'Offer Sent' ? 'Offer' : 'In Progress'
    }
    if (req.file) data.resumeUrl = `/uploads/resumes/${req.file.filename}`

    const candidate = await prisma.candidate.update({
      where: { id: req.params.id },
      data,
      include: { job: { select: { title: true } } },
    })

    res.json({ ...candidate, job: candidate.job.title })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/candidates/:id/convert - hire candidate into Employee + User
router.post('/:id/convert', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const candidate = await prisma.candidate.findUnique({
      where: { id: req.params.id },
      include: { job: true },
    })
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' })

    const names = splitName(candidate.name)
    const {
      firstName = names.firstName,
      lastName = names.lastName,
      email = candidate.email,
      phone = candidate.phone,
      dept = candidate.job.dept,
      role = candidate.job.title,
      manager,
      salary = candidate.job.minSalary || 0,
      joinDate = new Date().toISOString().slice(0, 10),
      employmentType = candidate.job.type || 'Full-time',
      password,
    } = req.body

    if (!firstName || !lastName || !email || !dept || !role || !joinDate || !password) {
      return res.status(400).json({ error: 'First name, last name, email, department, role, join date and password are required' })
    }
    const minLength = await getPasswordMinLength()
    if (String(password).length < minLength) return res.status(400).json({ error: `Password must be at least ${minLength} characters` })

    const hashed = await bcrypt.hash(password, 10)
    const fullName = `${firstName} ${lastName}`.trim()

    const result = await prisma.$transaction(async (tx) => {
      const managerEmployee = await resolveManager(tx, manager)
      const employeeId = await nextEmployeeId(tx)
      const user = await tx.user.create({
        data: {
          name: fullName,
          email,
          password: hashed,
          role: 'employee',
          dept,
          title: role,
          status: 'Active',
        },
      })

      const employee = await tx.employee.create({
        data: {
          id: employeeId,
          userId: user.id,
          name: fullName,
          email,
          phone: phone || null,
          dept,
          role,
          manager: managerEmployee?.name || manager || null,
          managerId: managerEmployee?.id || null,
          salary: parseInt(salary, 10) || 0,
          joined: joinDate,
          status: 'Active',
          employmentType,
          leaveBalance: 14,
        },
      })

      const updatedCandidate = await tx.candidate.update({
        where: { id: candidate.id },
        data: {
          status: 'Hired',
          stage: 'Hired',
          notes: [candidate.notes, `Converted to employee ${employeeId} on ${joinDate}`].filter(Boolean).join('\n'),
        },
        include: { job: { select: { title: true } } },
      })

      await createNotification(tx, {
        type: 'employee',
        msg: `${employee.name} was converted from candidate to employee`,
        path: `/hr/employees/${employee.id}`,
        audience: ['admin', 'hr'],
        dept,
      })
      const managerUserId = await getDirectManagerUserId(tx, employee)
      if (managerUserId) {
        await createNotification(tx, {
          type: 'employee',
          msg: `${employee.name} joined your team from recruitment`,
          path: '/manager/team',
          userIds: [managerUserId],
        })
      }
      if (employee.userId) {
        await createNotification(tx, {
          type: 'system',
          msg: 'Welcome to Fuchsius HRMS. Your employee portal account is ready.',
          path: '/employee/dashboard',
          userIds: [employee.userId],
        })
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CONVERT_CANDIDATE',
          module: 'Recruitment',
          detail: `Converted candidate ${candidate.name} to employee ${employee.id}`,
          ip: req.ip,
        },
      })

      return { employee, candidate: { ...updatedCandidate, job: updatedCandidate.job.title } }
    })

    res.status(201).json(result)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/candidates/:id/move
router.patch('/:id/move', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { stage } = req.body
    const status =
      stage === 'Hired'      ? 'Hired'       :
      stage === 'Offer Sent' ? 'Offer'        :
                               'In Progress'

    const candidate = await prisma.candidate.update({
      where: { id: req.params.id },
      data:  { stage, status },
      include: { job: { select: { title: true } } },
    })

    res.json({ ...candidate, job: candidate.job.title })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/candidates/:id/reject
router.patch('/:id/reject', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const candidate = await prisma.candidate.update({
      where: { id: req.params.id },
      data:  { status: 'Rejected', stage: 'Rejected' },
      include: { job: { select: { title: true } } },
    })
    res.json({ ...candidate, job: candidate.job.title })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
