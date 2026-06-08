const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const multer  = require('multer')
const path    = require('path')
const fs      = require('fs')
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')
const { sendWelcomeEmail } = require('../utils/mailer')
const { createNotification, getDirectManagerUserId } = require('../utils/notificationTargets')

const prisma = new PrismaClient()

// ── Multer setup for avatars ───────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'avatars')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${req.params.id}-avatar-${Date.now()}${ext}`)
  },
})
const allowedFileTypes = /pdf|doc|docx|jpg|jpeg|png/
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1)
  if (!allowedFileTypes.test(ext)) return cb(new Error('Only PDF, Word, JPG and PNG files are allowed'))
  cb(null, true)
}
const avatarFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1)
  if (!/jpg|jpeg|png|webp/.test(ext)) return cb(new Error('Only JPG, PNG and WebP profile pictures are allowed'))
  cb(null, true)
}

const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: avatarFileFilter })

// ── Multer setup for documents ─────────────────────────────────────
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'documents', req.params.id)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ts  = Date.now()
    const ext = path.extname(file.originalname)
    const base= path.basename(file.originalname, ext).replace(/\s+/g, '_')
    cb(null, `${ts}-${base}${ext}`)
  },
})
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter })

const getOwnEmployee = (userId) => prisma.employee.findUnique({ where: { userId } })
const removeUploadedFile = (relativePath) => {
  if (!relativePath || !relativePath.startsWith('/uploads/')) return
  const fullPath = path.join(__dirname, '..', relativePath.replace(/^\/+/, ''))
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
}
const getPasswordMinLength = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: 'password_min_length' } })
  return parseInt(setting?.value || '8', 10) || 8
}

const canAccessEmployee = async (req, employeeId, allowManager = false) => {
  if (req.user.role === 'admin' || req.user.role === 'hr') return true
  const target = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!target) return false
  if (target.userId === req.user.id) return true
  if (req.user.role === 'employee') return target.userId === req.user.id
  if (allowManager && req.user.role === 'manager') {
    const managerEmp = await getOwnEmployee(req.user.id)
    return (managerEmp && target.managerId === managerEmp.id) || target.manager === req.user.name
  }
  return false
}

const resolveManager = async (managerName) => {
  if (!managerName) return null
  return prisma.employee.findFirst({
    where: {
      status: 'Active',
      OR: [{ name: managerName }, { id: managerName }],
    },
    select: { id: true, name: true },
  })
}
const isManagerLikeRole = (role = '') => /manager|lead|head|supervisor|director/i.test(role)

const deleteEmployeeGraph = async (tx, employeeId, linkedUserId = null) => {
  await tx.employee.updateMany({ where: { managerId: employeeId }, data: { managerId: null, manager: null } })
  await tx.document.deleteMany({ where: { employeeId } })
  await tx.goal.deleteMany({ where: { employeeId } })
  await tx.performanceReview.deleteMany({ where: { employeeId } })
  await tx.payrollVariable.deleteMany({ where: { employeeId } })
  await tx.compensationStructure.deleteMany({ where: { employeeId } })
  await tx.payrollRecord.deleteMany({ where: { employeeId } })
  await tx.attendanceCorrection.deleteMany({ where: { employeeId } })
  await tx.attendance.deleteMany({ where: { employeeId } })
  await tx.leaveRequest.deleteMany({ where: { employeeId } })
  if (linkedUserId) {
    await tx.auditLog.updateMany({ where: { userId: linkedUserId }, data: { userId: null } })
    await tx.user.delete({ where: { id: linkedUserId } })
  }
  await tx.employee.delete({ where: { id: employeeId } })
}

// ── GET /api/employees ─────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { dept, status, search } = req.query
    const where = {}
    if (req.user.role === 'employee') {
      where.userId = req.user.id
    }
    if (req.user.role === 'manager') {
      const managerEmp = await getOwnEmployee(req.user.id)
      const directReportFilter = {
        OR: [
          ...(managerEmp ? [{ managerId: managerEmp.id }, { id: managerEmp.id }] : []),
          { manager: req.user.name },
        ],
      }
      Object.assign(where, directReportFilter)
    }
    if (dept)   where.dept   = dept
    if (status) where.status = status
    if (search) {
      const searchFilter = [
        { name:  { contains: search } },
        { email: { contains: search } },
        { role:  { contains: search } },
      ]
      where.AND = [...(where.AND || []), { OR: searchFilter }]
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
    })
    res.json(employees)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/employees/:id ─────────────────────────────────────────
router.get('/managers', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { status: 'Active' },
      select: { id: true, name: true, email: true, dept: true, role: true, manager: true, userId: true },
      orderBy: { name: 'asc' },
    })
    const users = await prisma.user.findMany({
      where: { status: 'Active', role: { in: ['manager', 'hr'] } },
      select: { id: true, name: true, email: true, dept: true, title: true, role: true },
      orderBy: { name: 'asc' },
    })
    const reportingManagerNames = new Set(employees.map(emp => emp.manager).filter(Boolean))
    const byName = new Map()

    employees.forEach(emp => {
      if (!reportingManagerNames.has(emp.name)) return
      byName.set(emp.name, {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        dept: emp.dept,
        role: emp.role,
        source: 'employee',
      })
    })

    users.forEach(user => {
      if (byName.has(user.name)) return
      byName.set(user.name, {
        id: `user:${user.id}`,
        name: user.name,
        email: user.email,
        dept: user.dept || '',
        role: user.title || user.role,
        source: 'user',
      })
    })

    reportingManagerNames.forEach(name => {
      if (byName.has(name)) return
      byName.set(name, {
        id: `name:${name}`,
        name,
        email: '',
        dept: '',
        role: 'Reporting Manager',
        source: 'existing-reporting-line',
      })
    })

    res.json(Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const allowed = await canAccessEmployee(req, req.params.id, true)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    const emp = await prisma.employee.findUnique({ where: { id: req.params.id } })
    if (!emp) return res.status(404).json({ error: 'Employee not found' })
    res.json(emp)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/employees ────────────────────────────────────────────
router.post('/', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { firstName, lastName, email, phone, dept, role, systemRole = 'employee', manager, salary, joinDate, employmentType, address, emergencyName, emergencyPhone, emergencyRel, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!firstName || !lastName || !normalizedEmail || !dept || !role || !joinDate || !password) {
      return res.status(400).json({ error: 'First name, last name, email, department, role, join date and password are required' })
    }
    const allowedSystemRoles = req.user.role === 'admin'
      ? ['employee', 'manager', 'hr', 'admin']
      : ['employee']
    const normalizedSystemRole = String(systemRole || 'employee').toLowerCase()
    if (!allowedSystemRoles.includes(normalizedSystemRole)) {
      return res.status(403).json({ error: 'You are not allowed to create this system access role' })
    }
    const minLength = await getPasswordMinLength()
    if (String(password).length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` })
    }

    // Auto-generate employee ID
    const all = await prisma.employee.findMany({ select: { id: true } })
    const maxNum = all.reduce((max, e) => {
      const n = parseInt(e.id.replace('E', ''), 10)
      return n > max ? n : max
    }, 0)
    const newId = `E${String(maxNum + 1).padStart(3, '0')}`

    const fullName = `${firstName} ${lastName}`.trim()
    const hashed = await bcrypt.hash(password, 10)
    const managerEmployee = await resolveManager(manager)

    const emp = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName,
          email: normalizedEmail,
          password: hashed,
          role: normalizedSystemRole,
          dept,
          title: role,
          status: 'Active',
        },
      })

      return tx.employee.create({
        data: {
          id: newId,
          userId: user.id,
          name: fullName,
          email: normalizedEmail,
          phone:          phone || null,
          dept,
          role,
          manager:        managerEmployee?.name || manager || null,
          managerId:      managerEmployee?.id || null,
          salary:         parseInt(salary, 10) || 0,
          joined:         joinDate,
          status:         'Active',
          leaveBalance:   14,
          employmentType: employmentType || 'Full-time',
          address:        address || null,
          emergencyName:  emergencyName || null,
          emergencyPhone: emergencyPhone || null,
          emergencyRel:   emergencyRel || null,
        },
      })
    })

    let emailDelivery = null
    try {
      emailDelivery = await sendWelcomeEmail({
        employee: emp,
        password,
        createdBy: req.user.name,
      })
    } catch (mailErr) {
      emailDelivery = {
        sent: false,
        mode: 'failed',
        message: mailErr.message || 'Welcome email failed',
      }
    }

    const managerUserId = await getDirectManagerUserId(prisma, emp)
    await createNotification(prisma, {
      type:     'employee',
      msg:      `${emp.name} joined ${emp.dept} as ${emp.role}. Welcome email ${emailDelivery?.sent ? 'sent' : 'needs review'}.`,
      path:     `/hr/employees/${newId}`,
      audience: ['admin', 'hr'],
      userIds:  [managerUserId],
    })
    if (emp.userId) {
      await createNotification(prisma, {
        type:    'system',
        msg:     'Welcome to Fuchsius HRMS. Your employee portal account is ready.',
        path:    '/employee/dashboard',
        userIds: [emp.userId],
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'CREATE_EMPLOYEE', module: 'Employees', detail: `Created ${emp.name} (${newId})`, ip: req.ip },
    })

    res.status(201).json({ employee: emp, emailDelivery })
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

// ── PUT /api/employees/:id ─────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    // Employees can only edit their own profile
    if (req.user.role === 'employee') {
      const myEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } })
      if (!myEmp || myEmp.id !== req.params.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    const allowed = req.user.role === 'employee'
      ? ['name','phone','address','emergencyName','emergencyPhone','emergencyRel','avatar']
      : ['name','email','phone','dept','role','manager','salary','status','employmentType','address','emergencyName','emergencyPhone','emergencyRel','leaveBalance','joined','avatar']
    const data = {}
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k] })
    if (data.salary) data.salary = parseInt(data.salary, 10)
    if (data.leaveBalance !== undefined) data.leaveBalance = parseInt(data.leaveBalance, 10) || 0
    if (data.manager !== undefined && req.user.role !== 'employee') {
      const managerEmployee = await resolveManager(data.manager)
      data.manager = managerEmployee?.name || data.manager || null
      data.managerId = managerEmployee?.id || null
    }

    const emp = await prisma.employee.update({ where: { id: req.params.id }, data })

    if (req.user.role !== 'employee') {
      const userUpdates = {}
      if (data.name !== undefined) userUpdates.name = data.name
      if (data.email !== undefined) userUpdates.email = data.email
      if (data.dept !== undefined) userUpdates.dept = data.dept
      if (data.role !== undefined) userUpdates.title = data.role
      if (data.status !== undefined && emp.userId) userUpdates.status = data.status
      if (Object.keys(userUpdates).length && emp.userId) {
        await prisma.user.update({ where: { id: emp.userId }, data: userUpdates })
      }
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE_EMPLOYEE', module: 'Employees', detail: `Updated ${emp.name} (${req.params.id})`, ip: req.ip },
    })

    res.json(emp)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/employees/:id (soft delete) ────────────────────────
router.delete('/:id', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    })
    if (!existing) return res.status(404).json({ error: 'Employee not found' })
    if (req.user.role === 'hr' && existing.user && existing.user.role !== 'employee') {
      return res.status(403).json({ error: 'Only admin can deactivate privileged employee accounts' })
    }
    const emp = await prisma.employee.update({
      where: { id: req.params.id },
      data:  { status: 'Inactive' },
    })
    if (emp.userId) {
      await prisma.user.update({ where: { id: emp.userId }, data: { status: 'Inactive' } })
    }
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DELETE_EMPLOYEE', module: 'Employees', detail: `Deactivated ${emp.name} (${req.params.id})`, ip: req.ip },
    })
    res.json({ message: 'Employee deactivated', employee: emp })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/employees/:id/permanent
router.delete('/:id/permanent', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { documents: true, user: true },
    })
    if (!emp) return res.status(404).json({ error: 'Employee not found' })
    if (emp.userId === req.user.id) return res.status(400).json({ error: 'Cannot permanently delete your own employee profile' })
    if (req.user.role === 'hr' && emp.user && emp.user.role !== 'employee') {
      return res.status(403).json({ error: 'Only admin can permanently delete privileged employee accounts' })
    }

    await prisma.$transaction(async (tx) => {
      await deleteEmployeeGraph(tx, emp.id, emp.userId)
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'PERMANENT_DELETE_EMPLOYEE', module: 'Employees', detail: `Permanently deleted ${emp.name} (${emp.id})`, ip: req.ip },
      })
    })

    emp.documents.forEach(doc => removeUploadedFile(doc.filePath))
    res.json({ message: 'Employee permanently deleted', employee: { id: emp.id, name: emp.name } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/employees/:id/avatar ────────────────────────────────
router.post('/:id/avatar', auth, uploadAvatar.single('avatar'), async (req, res) => {
  try {
    const allowed = await canAccessEmployee(req, req.params.id, false)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const url = `/uploads/avatars/${req.file.filename}`
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } })
    const emp = await prisma.employee.update({ where: { id: req.params.id }, data: { avatar: url } })
    if (emp.userId) await prisma.user.update({ where: { id: emp.userId }, data: { avatar: url } })
    if (existing?.avatar && existing.avatar !== url) removeUploadedFile(existing.avatar)
    res.json({ avatar: url, employee: emp })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/employees/:id/avatar
router.delete('/:id/avatar', auth, async (req, res) => {
  try {
    const allowed = await canAccessEmployee(req, req.params.id, false)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Employee not found' })

    const emp = await prisma.employee.update({ where: { id: req.params.id }, data: { avatar: null } })
    if (emp.userId) await prisma.user.update({ where: { id: emp.userId }, data: { avatar: null } })

    removeUploadedFile(existing.avatar)

    res.json({ avatar: null, employee: emp })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GET /api/employees/:id/documents ──────────────────────────────
router.get('/:id/documents', auth, async (req, res) => {
  try {
    const allowed = await canAccessEmployee(req, req.params.id, true)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const docs = await prisma.document.findMany({
      where: { employeeId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json(docs)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── POST /api/employees/:id/documents ─────────────────────────────
router.post('/:id/documents', auth, uploadDoc.single('file'), async (req, res) => {
  try {
    const allowed = await canAccessEmployee(req, req.params.id, false)
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const { category = 'General' } = req.body
    const filePath = `/uploads/documents/${req.params.id}/${req.file.filename}`
    const uploadedBy = req.user.role === 'hr' || req.user.role === 'admin' ? req.user.name : (await getOwnEmployee(req.user.id))?.name || req.user.name

    const doc = await prisma.document.create({
      data: {
        employeeId: req.params.id,
        name:       req.file.originalname,
        category,
        uploadedBy,
        uploadedOn: new Date().toISOString().slice(0, 10),
        status:     (req.user.role === 'hr' || req.user.role === 'admin') ? 'Verified' : 'Pending Review',
        filePath,
      },
    })

    const docEmployee = await prisma.employee.findUnique({ where: { id: req.params.id }, select: { userId: true, name: true } })
    if (req.user.role === 'employee') {
      await createNotification(prisma, {
        type: 'document',
        msg: `${doc.name} was uploaded by ${docEmployee?.name || req.params.id} and needs review`,
        path: `/hr/employees/${req.params.id}`,
        audience: ['hr', 'admin'],
      })
    } else if (docEmployee?.userId) {
      await createNotification(prisma, {
        type: 'document',
        msg: `${doc.name} was added to your document vault`,
        path: '/employee/documents',
        userIds: [docEmployee.userId],
      })
    }

    res.status(201).json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── PATCH /api/employees/:id/documents/:docId/verify ──────────────
router.patch('/:id/documents/:docId/verify', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const doc = await prisma.document.update({
      where: { id: req.params.docId },
      data:  { status: 'Verified' },
    })
    res.json(doc)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── DELETE /api/employees/:id/documents/:docId ────────────────────
router.delete('/:id/documents/:docId', auth, requireRole('admin', 'hr'), async (req, res) => {
  try {
    const existing = await prisma.document.findUnique({ where: { id: req.params.docId } })
    if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: 'Document not found' })
    const doc = await prisma.document.delete({ where: { id: req.params.docId } })
    // Remove file from disk
    if (doc.filePath) {
      const fullPath = path.join(__dirname, '..', doc.filePath)
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    }
    res.json({ message: 'Document deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
