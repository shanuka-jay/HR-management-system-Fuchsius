const fs = require('fs/promises')
const path = require('path')
const PDFDocument = require('pdfkit')
const { sendMail } = require('./mailer')

const money = (value, currency = 'LKR') =>
  `${currency} ${Number(value || 0).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`

const safeFilePart = (value = '') => String(value).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '')

const buildPayslipPdf = ({ record, employee, compensation }) => new Promise((resolve, reject) => {
  const chunks = []
  const doc = new PDFDocument({ size: 'A4', margin: 44 })
  doc.on('data', chunk => chunks.push(chunk))
  doc.on('error', reject)
  doc.on('end', () => resolve(Buffer.concat(chunks)))

  const currency = record.currency || 'LKR'
  const line = (label, value, x = 44, y = null) => {
    if (y !== null) doc.y = y
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(label, x, doc.y, { continued: true, width: 170 })
    doc.font('Helvetica-Bold').fillColor('#111827').text(value || '-', { continued: false })
  }
  const amountRow = (label, value, tone = '#111827') => {
    const y = doc.y
    doc.font('Helvetica').fontSize(10).fillColor('#374151').text(label, 64, y)
    doc.font('Helvetica-Bold').fillColor(tone).text(money(value, currency), 360, y, { width: 150, align: 'right' })
    doc.moveDown(0.45)
  }

  doc.rect(0, 0, 595.28, 104).fill('#111827')
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Fuchsius HRMS', 44, 34)
  doc.font('Helvetica').fontSize(10).fillColor('#d1d5db').text('Official Payroll Payslip', 44, 64)
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text(record.month, 360, 38, { width: 150, align: 'right' })
  doc.font('Helvetica').fontSize(9).fillColor('#d1d5db').text(`Issued ${new Date().toISOString().slice(0, 10)}`, 360, 61, { width: 150, align: 'right' })

  doc.y = 132
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Employee Details')
  doc.moveDown(0.8)
  line('Employee', employee.name)
  line('Employee ID', employee.id)
  line('Department', employee.dept)
  line('Role', employee.role)
  line('Email', employee.email)
  line('Bank', compensation?.bankName ? `${compensation.bankName} / ${compensation.bankAccount || '-'}` : 'Not recorded')

  doc.moveDown(1.2)
  doc.roundedRect(44, doc.y, 507, 210, 8).strokeColor('#e5e7eb').stroke()
  doc.y += 18
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Earnings', 64)
  doc.moveDown(0.8)
  amountRow('Basic salary', record.basic)
  amountRow('Allowances', record.allowances)
  amountRow('Overtime', record.overtime)
  amountRow('Bonus', record.bonus)
  amountRow('Reimbursements', record.reimbursements)
  doc.moveDown(0.4)
  amountRow('Gross pay', record.gross, '#047857')

  doc.moveDown(1.1)
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Deductions', 64)
  doc.moveDown(0.8)
  amountRow('Tax', record.tax, '#b91c1c')
  amountRow('Unpaid leave deduction', record.unpaidLeaveDeduction, '#b91c1c')
  amountRow('Recurring deductions', record.recurringDeductions, '#b91c1c')
  amountRow('One-time deductions', record.oneTimeDeductions, '#b91c1c')
  doc.moveDown(0.4)
  amountRow('Total deductions', record.deductions, '#b91c1c')

  doc.moveDown(1.3)
  doc.rect(44, doc.y, 507, 54).fill('#f3f4f6')
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text('Net Pay', 64, doc.y + 18)
  doc.fontSize(18).fillColor('#047857').text(money(record.net, currency), 330, doc.y - 18, { width: 180, align: 'right' })
  doc.moveDown(2.6)

  doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
    .text('This computer-generated payslip is valid without a signature. Please contact HR for corrections before the next payroll cycle.', 44, 760, { width: 507, align: 'center' })

  doc.end()
})

const savePayslipPdf = async ({ record, employee, compensation }) => {
  const pdf = await buildPayslipPdf({ record, employee, compensation })
  const dir = path.join(__dirname, '..', 'uploads', 'payslips')
  await fs.mkdir(dir, { recursive: true })
  const filename = `${safeFilePart(employee.id)}-${safeFilePart(record.month)}-payslip.pdf`
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, pdf)
  return { pdf, filePath, filename }
}

const sendPayslipEmail = async ({ record, employee, pdf, filename }) => {
  const currency = record.currency || 'LKR'
  const subject = `${record.month} payslip - Fuchsius HRMS`
  const text = [
    `Hi ${employee.name},`,
    '',
    `Your ${record.month} salary has been marked as paid.`,
    `Net pay: ${money(record.net, currency)}`,
    '',
    'Your official payslip PDF is attached to this email. You can also view your payroll history in the Fuchsius HRMS employee portal.',
    '',
    'Fuchsius HR Team',
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <h2>${record.month} payslip</h2>
      <p>Hi ${employee.name},</p>
      <p>Your salary has been marked as paid.</p>
      <p><strong>Net pay:</strong> ${money(record.net, currency)}</p>
      <p>Your official payslip PDF is attached to this email. You can also view your payroll history in the Fuchsius HRMS employee portal.</p>
      <p style="color:#6b7280;font-size:12px">Fuchsius HR Team</p>
    </div>
  `

  return sendMail({
    to: employee.email,
    subject,
    text,
    html,
    attachments: [{ filename, contentType: 'application/pdf', content: pdf }],
  })
}

module.exports = { savePayslipPdf, sendPayslipEmail }
