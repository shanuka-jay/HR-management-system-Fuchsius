const fs = require('fs/promises')
const path = require('path')
const net = require('net')
const tls = require('tls')

const smtpConfigured = () => Boolean(process.env.SMTP_HOST)

const escapeHeader = (value = '') => String(value).replace(/[\r\n]+/g, ' ').trim()
const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const buildMessage = ({ to, subject, text, html, attachments = [] }) => {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'Fuchsius HRMS <no-reply@fuchsius.lk>'
  const mixedBoundary = `Fuchsius-HRMS-mixed-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const altBoundary = `Fuchsius-HRMS-alt-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const parts = [
    `From: ${escapeHeader(from)}`,
    `To: ${escapeHeader(to)}`,
    `Subject: ${escapeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    '',
    `--${altBoundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${altBoundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${altBoundary}--`,
  ]

  attachments.forEach((attachment) => {
    const filename = escapeHeader(attachment.filename || 'attachment')
    const contentType = attachment.contentType || 'application/octet-stream'
    const content = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(String(attachment.content || ''), 'utf8')
    parts.push(
      '',
      `--${mixedBoundary}`,
      `Content-Type: ${contentType}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      content.toString('base64').replace(/.{1,76}/g, '$&\r\n').trim()
    )
  })

  parts.push('', `--${mixedBoundary}--`, '')
  return parts.join('\r\n')
}

const waitLine = (socket) => new Promise((resolve, reject) => {
  let buffer = ''
  const onData = (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    const last = lines[lines.length - 2] || ''
    if (/^\d{3} /.test(last)) {
      cleanup()
      resolve(buffer)
    }
  }
  const cleanup = () => {
    socket.off('data', onData)
    socket.off('error', onError)
  }
  const onError = (err) => {
    cleanup()
    reject(err)
  }
  socket.on('data', onData)
  socket.on('error', onError)
})

const sendCommand = async (socket, command, expected = /^[23]/) => {
  socket.write(`${command}\r\n`)
  const response = await waitLine(socket)
  if (!expected.test(response)) throw new Error(`SMTP command failed: ${command} -> ${response.trim()}`)
  return response
}

const connectSocket = () => new Promise((resolve, reject) => {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? 465 : 587))
  const secure = process.env.SMTP_SECURE === 'true'
  const socket = secure
    ? tls.connect({ host, port, servername: host }, () => resolve(socket))
    : net.connect({ host, port }, () => resolve(socket))
  socket.setTimeout(20000)
  socket.once('error', reject)
  socket.once('timeout', () => reject(new Error('SMTP connection timed out')))
})

const sendSmtp = async (mail) => {
  let socket = await connectSocket()
  await waitLine(socket)
  const ehlo = await sendCommand(socket, `EHLO ${process.env.SMTP_EHLO || 'fuchsius.lk'}`)

  if (process.env.SMTP_SECURE !== 'true' && /STARTTLS/i.test(ehlo) && process.env.SMTP_STARTTLS !== 'false') {
    await sendCommand(socket, 'STARTTLS')
    socket = tls.connect({ socket, servername: process.env.SMTP_HOST })
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve)
      socket.once('error', reject)
    })
    await sendCommand(socket, `EHLO ${process.env.SMTP_EHLO || 'fuchsius.lk'}`)
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    await sendCommand(socket, 'AUTH LOGIN', /^334/)
    await sendCommand(socket, Buffer.from(process.env.SMTP_USER).toString('base64'), /^334/)
    await sendCommand(socket, Buffer.from(process.env.SMTP_PASS).toString('base64'), /^235/)
  }

  const from = process.env.MAIL_FROM_ADDRESS || process.env.SMTP_USER || 'no-reply@fuchsius.lk'
  await sendCommand(socket, `MAIL FROM:<${from}>`)
  await sendCommand(socket, `RCPT TO:<${mail.to}>`)
  await sendCommand(socket, 'DATA', /^354/)
  socket.write(`${mail.raw.replace(/\r?\n\./g, '\r\n..')}\r\n.\r\n`)
  await waitLine(socket)
  await sendCommand(socket, 'QUIT').catch(() => {})
  socket.end()
}

const saveToOutbox = async (mail) => {
  const outboxDir = path.join(__dirname, '..', 'outbox')
  await fs.mkdir(outboxDir, { recursive: true })
  const safeTo = mail.to.replace(/[^a-z0-9_.-]+/gi, '_')
  const file = path.join(outboxDir, `${Date.now()}-${safeTo}.eml`)
  await fs.writeFile(file, mail.raw, 'utf8')
  return file
}

const sendMail = async ({ to, subject, text, html, attachments = [] }) => {
  const raw = buildMessage({ to, subject, text, html, attachments })
  const mail = { to, subject, text, html, attachments, raw }

  if (!smtpConfigured()) {
    const outboxPath = await saveToOutbox(mail)
    return {
      sent: false,
      mode: 'outbox',
      message: 'SMTP is not configured. Email was saved to the local outbox.',
      outboxPath,
    }
  }

  await sendSmtp(mail)
  return { sent: true, mode: 'smtp', message: 'Email sent.' }
}

const sendWelcomeEmail = async ({ employee, password, createdBy }) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000/login'
  const safeName = escapeHtml(employee.name)
  const safeEmail = escapeHtml(employee.email)
  const safePassword = escapeHtml(password)
  const safeAppUrl = escapeHtml(appUrl)
  const subject = 'Welcome to Fuchsius HRMS - your employee portal login'
  const text = [
    `Hi ${employee.name},`,
    '',
    'Your Fuchsius HRMS employee portal account is ready.',
    '',
    `Login URL: ${appUrl}`,
    `Email: ${employee.email}`,
    `Temporary password: ${password}`,
    '',
    'Please sign in and change your password from Employee Profile as soon as possible.',
    createdBy ? `Created by: ${createdBy}` : '',
    '',
    'Fuchsius HRMS',
  ].filter(Boolean).join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <h2>Welcome to Fuchsius HRMS</h2>
      <p>Hi ${safeName},</p>
      <p>Your employee portal account is ready.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 12px;color:#6b7280">Login URL</td><td style="padding:6px 12px"><a href="${safeAppUrl}">${safeAppUrl}</a></td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280">Email</td><td style="padding:6px 12px"><strong>${safeEmail}</strong></td></tr>
        <tr><td style="padding:6px 12px;color:#6b7280">Temporary password</td><td style="padding:6px 12px"><strong>${safePassword}</strong></td></tr>
      </table>
      <p>Please sign in and change your password from Employee Profile as soon as possible.</p>
      <p style="color:#6b7280;font-size:12px">Fuchsius HRMS</p>
    </div>
  `
  return sendMail({ to: employee.email, subject, text, html })
}

module.exports = { sendMail, sendWelcomeEmail }
