const jwt = require('jsonwebtoken')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
    if (!user) return res.status(401).json({ error: 'User not found' })
    if (user.status === 'Inactive') return res.status(403).json({ error: 'Account is inactive' })
    const linkedEmployee = user.role === 'employee'
      ? await prisma.employee.findUnique({ where: { userId: user.id } })
      : null
    if (user.role === 'employee' && linkedEmployee?.status === 'Inactive') {
      return res.status(403).json({ error: 'Employee profile is inactive' })
    }

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' })
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Role-based access control middleware factory
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` })
  }
  next()
}

module.exports = { auth, requireRole }
