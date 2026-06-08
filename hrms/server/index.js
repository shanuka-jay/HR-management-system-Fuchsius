require('dotenv').config()
const express = require('express')
const cors    = require('cors')
const path    = require('path')
const fs      = require('fs')

const app  = express()
const PORT = process.env.PORT || 5000

// ── Ensure uploads dir exists ──────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

// ── Middleware ─────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static file serving for uploads
app.use('/uploads', express.static(uploadsDir))

// API root
app.get('/', (req, res) => {
  res.json({
    name: 'Fuchsius HRMS API',
    status: 'ok',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      employees: '/api/employees',
      attendance: '/api/attendance',
    },
  })
})

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'))
app.use('/api/employees',     require('./routes/employees'))
app.use('/api/leaves',        require('./routes/leaves'))
app.use('/api/attendance',    require('./routes/attendance'))
app.use('/api/payroll',       require('./routes/payroll'))
app.use('/api/jobs',          require('./routes/jobs'))
app.use('/api/candidates',    require('./routes/candidates'))
app.use('/api/performance',   require('./routes/performance'))
app.use('/api/departments',   require('./routes/departments'))
app.use('/api/users',         require('./routes/users'))
app.use('/api/notifications', require('./routes/notifications'))
app.use('/api/audit-logs',    require('./routes/auditLogs'))
app.use('/api/settings',      require('./routes/settings'))
app.use('/api/holidays',      require('./routes/holidays'))
app.use('/api/reports',       require('./routes/reports'))

// ── Health check ───────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
})

// ── 404 handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` })
})

// ── Error handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Internal Server Error' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 Fuchsius HRMS API running on http://localhost:${PORT}`)
  console.log(`📂 Uploads dir: ${uploadsDir}`)
})
