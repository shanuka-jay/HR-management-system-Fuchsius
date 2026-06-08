const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { OAuth2Client } = require('google-auth-library')
const { PrismaClient } = require('@prisma/client')
const { auth } = require('../middleware/auth')

const prisma = new PrismaClient()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const getPasswordMinLength = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: 'password_min_length' } })
  return parseInt(setting?.value || '8', 10) || 8
}

const createSessionPayload = async (user, ip, action = 'LOGIN') => {
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
  await prisma.auditLog.create({
    data: { userId: user.id, action, module: 'Auth', detail: `${user.name} logged in`, ip },
  })

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )

  const { password: _pw, ...userWithoutPw } = user
  const employee = await prisma.employee.findUnique({ where: { userId: user.id } })
  return { token, user: userWithoutPw, employee }
}

const ensureActiveUser = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) return { error: 'Email is required' }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) return { error: 'No Fuchsius account found for this email' }
  if (user.status === 'Inactive') return { error: 'Account is inactive' }

  const linkedEmployee = await prisma.employee.findUnique({ where: { userId: user.id } })
  if (user.role === 'employee' && linkedEmployee?.status === 'Inactive') {
    return { error: 'Employee profile is inactive' }
  }
  return { user, linkedEmployee }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail || !password) return res.status(400).json({ error: 'Email and password required' })

    const result = await ensureActiveUser(normalizedEmail)
    if (result.error) return res.status(401).json({ error: result.error === 'Email is required' ? result.error : 'Invalid credentials' })
    const { user } = result

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    res.json(await createSessionPayload(user, req.ip, 'LOGIN'))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const credential = String(req.body.credential || '').trim()
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google SSO is not configured.' })
    }
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required.' })
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
    const payload = ticket.getPayload()
    const email = String(payload?.email || '').trim().toLowerCase()

    if (!payload?.email_verified) {
      return res.status(401).json({ error: 'Google email is not verified.' })
    }
    if (!email.endsWith('@fuchsius.lk')) {
      return res.status(403).json({ error: 'Use your Fuchsius Google Workspace email.' })
    }

    const result = await ensureActiveUser(email)
    if (result.error) return res.status(401).json({ error: result.error })
    res.json(await createSessionPayload(result.user, req.ip, 'GOOGLE_SSO_LOGIN'))
  } catch (err) {
    console.error('Google SSO verification failed:', err.message)
    res.status(401).json({ error: 'Google sign-in could not be verified.' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.notification.create({
        data: {
          type: 'system',
          msg: `${user.name} requested password reset support`,
          path: '/admin/users',
          audience: 'admin,hr',
          userIds: user.id,
        },
      })
      await prisma.auditLog.create({
        data: { userId: user.id, action: 'PASSWORD_RESET_REQUEST', module: 'Auth', detail: `Password reset requested for ${email}`, ip: req.ip },
      })
    }

    res.json({ message: 'If this email is registered, HR support will receive a reset request.' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { password: _pw, ...userWithoutPw } = req.user
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } })
    res.json({ user: userWithoutPw, employee })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/logout
router.post('/logout', auth, async (req, res) => {
  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'LOGOUT', module: 'Auth', detail: `${req.user.name} logged out`, ip: req.ip },
  })
  res.json({ message: 'Logged out successfully' })
})

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const minLength = await getPasswordMinLength()
    if (!newPassword || newPassword.length < minLength) {
      return res.status(400).json({ error: `New password must be at least ${minLength} characters` })
    }
    const valid = await bcrypt.compare(currentPassword, req.user.password)
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } })
    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
