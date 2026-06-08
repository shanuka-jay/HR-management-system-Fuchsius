const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const { auth, requireRole } = require('../middleware/auth')

const prisma = new PrismaClient()

const getPasswordMinLength = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: 'password_min_length' } })
  return parseInt(setting?.value || '8', 10) || 8
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
    where: { status: 'Active', OR: [{ name: managerName }, { id: managerName }] },
    select: { id: true, name: true },
  })
}

// GET /api/users (Admin only)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id:true, name:true, email:true, role:true, dept:true, title:true, status:true, lastLogin:true, createdAt:true,
        employee: { select: { id:true, status:true, manager:true, salary:true, joined:true, employmentType:true, leaveBalance:true } },
      },
      orderBy: { name: 'asc' },
    })
    const result = users.map(u => ({
      ...u,
      lastLogin: u.lastLogin ? u.lastLogin.toISOString() : null,
    }))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/users
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, dept, title, phone, manager, salary, joinDate, employmentType, leaveBalance } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!name || !normalizedEmail || !password || !role || !dept || !title || !joinDate) {
      return res.status(400).json({ error: 'Name, email, password, role, department, job title and join date are required' })
    }
    const minLength = await getPasswordMinLength()
    if (String(password).length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` })
    }
    if (role === 'employee') {
      return res.status(400).json({ error: 'Create employee accounts from HR > Add Employee so login is linked to an employee record' })
    }

    const hashed = await bcrypt.hash(password || 'changeme123', 10)
    const result = await prisma.$transaction(async (tx) => {
      const managerEmployee = await resolveManager(tx, manager)
      const user = await tx.user.create({
        data: { name, email: normalizedEmail, password: hashed, role, dept: dept || null, title: title || null, status: 'Active' },
        select: { id:true, name:true, email:true, role:true, dept:true, title:true, status:true, createdAt:true },
      })
      const employee = await tx.employee.create({
        data: {
          id: await nextEmployeeId(tx),
          userId: user.id,
          name,
          email: normalizedEmail,
          phone: phone || null,
          dept,
          role: title,
          manager: managerEmployee?.name || manager || null,
          managerId: managerEmployee?.id || null,
          salary: parseInt(salary, 10) || 0,
          joined: joinDate,
          status: 'Active',
          employmentType: employmentType || 'Full-time',
          leaveBalance: parseInt(leaveBalance, 10) || 14,
        },
      })

      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'CREATE_USER', module: 'Users', detail: `Created ${role} user and employee ${name}`, ip: req.ip },
      })
      return { ...user, employee }
    })
    res.status(201).json(result)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/:id
router.put('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, dept, title, status } = req.body
    const data = {}
    if (name   !== undefined) data.name   = name
    if (email  !== undefined) data.email  = String(email || '').trim().toLowerCase()
    if (password) {
      const minLength = await getPasswordMinLength()
      if (String(password).length < minLength) {
        return res.status(400).json({ error: `Password must be at least ${minLength} characters` })
      }
      data.password = await bcrypt.hash(password, 10)
    }
    if (role   !== undefined) data.role   = role
    if (dept   !== undefined) data.dept   = dept
    if (title  !== undefined) data.title  = title
    if (status !== undefined) data.status = status

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id:true, name:true, email:true, role:true, dept:true, title:true, status:true },
    })
    if (user.role !== 'employee') {
      await prisma.employee.updateMany({
        where: { userId: user.id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.dept !== undefined ? { dept: data.dept } : {}),
          ...(data.title !== undefined ? { role: data.title } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
        },
      })
    }

    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE_USER', module: 'Users', detail: `Updated user ${user.name}`, ip: req.ip },
    })

    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/users/:id (deactivate or permanent delete with ?permanent=true)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' })
    }
    const permanent = req.query.permanent === 'true'
    if (permanent) {
      const existing = await prisma.user.findUnique({
        where: { id: req.params.id },
        include: { employee: true },
      })
      if (!existing) return res.status(404).json({ error: 'User not found' })
      await prisma.$transaction(async (tx) => {
        if (existing.employee) {
          await tx.employee.update({
            where: { id: existing.employee.id },
            data: { userId: null, status: 'Inactive' },
          })
        }
        await tx.auditLog.updateMany({ where: { userId: existing.id }, data: { userId: null } })
        await tx.user.delete({ where: { id: existing.id } })
        await tx.auditLog.create({
          data: { userId: req.user.id, action: 'PERMANENT_DELETE_USER', module: 'Users', detail: `Permanently deleted user ${existing.name}`, ip: req.ip },
        })
      })
      return res.json({ message: 'User permanently deleted', user: { id: existing.id, name: existing.name } })
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: 'Inactive' },
      select: { id:true, name:true, status:true },
    })
    await prisma.employee.updateMany({ where: { userId: user.id }, data: { status: 'Inactive' } })
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DEACTIVATE_USER', module: 'Users', detail: `Deactivated ${user.name}`, ip: req.ip },
    })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/me/profile (update own profile)
router.put('/me/profile', auth, async (req, res) => {
  try {
    const { name, email, dept, title, avatar } = req.body
    const data = {}
    if (name  !== undefined) data.name  = name
    if (email !== undefined) data.email = email
    if (dept  !== undefined) data.dept  = dept
    if (title !== undefined) data.title = title
    if (avatar !== undefined) data.avatar = avatar

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id:true, name:true, email:true, role:true, dept:true, title:true, avatar:true, status:true },
    })
    await prisma.employee.updateMany({
      where: { userId: user.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(avatar !== undefined ? { avatar } : {}),
      },
    })
    res.json(user)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already exists' })
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
