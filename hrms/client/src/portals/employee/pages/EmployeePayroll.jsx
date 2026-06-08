import React, { useState, useEffect } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { Download, DollarSign, FileText, Landmark, Mail, Receipt, ShieldCheck, Loader2 } from 'lucide-react'
import { Cell, Pie, PieChart as RechartsPie, ResponsiveContainer, Tooltip } from 'recharts'
import { payrollApi } from '../../../api/services'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'
import { formatCurrency } from '../../../utils/currency'

const COLORS = ['#111827', '#6B7280', '#D1D5DB']

const money = (value, currency = 'LKR') => formatCurrency(value, currency)

const buildPayslipHtml = ({ employee, selected, breakdown, deductions }) => {
  const currency = selected?.currency || 'LKR'
  const earningsTotal = breakdown.reduce((sum, item) => sum + item.amount, 0)
  const deductionsTotal = deductions.reduce((sum, item) => sum + item.amount, 0)
  const rows = (items, negative = false) => items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td class="amount">${negative ? '-' : ''}${money(item.amount, currency)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
  <html>
    <head>
      <title>${employee.name}-${selected.month}-payslip.pdf</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #111827; padding: 28px; background: #f3f4f6; }
        .page { background: white; border: 1px solid #d1d5db; padding: 28px; max-width: 860px; margin: 0 auto; }
        .brand { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: #6b7280; font-weight: 800; }
        .top { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 18px; }
        h1 { margin: 6px 0 4px; font-size: 26px; }
        h2 { margin: 24px 0 10px; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #374151; }
        p { margin: 2px 0; font-size: 12px; color: #4b5563; }
        .badge { display: inline-block; margin-top: 8px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 18px; }
        .box { border: 1px solid #e5e7eb; background: #f9fafb; padding: 12px; }
        .label { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: .08em; }
        .value { font-size: 13px; color: #111827; font-weight: 700; margin-top: 3px; }
        table { border-collapse: collapse; width: 100%; border: 1px solid #e5e7eb; }
        th { background: #111827; color: white; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
        td { border-top: 1px solid #e5e7eb; padding: 10px; font-size: 12px; }
        .amount { text-align: right; font-weight: 700; }
        .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 18px; }
        .total { border: 1px solid #d1d5db; padding: 12px; }
        .net { background: #111827; color: white; }
        .net .label, .net .value { color: white; }
        .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
        @media print { body { background: white; padding: 0; } .page { border: 0; } }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="top">
          <div>
            <div class="brand">Fuchsius HRMS</div>
            <h1>Payslip</h1>
            <p>${selected.month} payroll statement</p>
            <span class="badge">Paid</span>
          </div>
          <div>
            <p><strong>Issued:</strong> ${selected.issued}</p>
            <p><strong>Employee ID:</strong> ${employee.id}</p>
            <p><strong>Payment Method:</strong> Bank transfer</p>
            <p><strong>Reference:</strong> PAY-${employee.id}-${selected.month.replace(' ', '-')}</p>
          </div>
        </div>

        <div class="grid">
          <div class="box"><div class="label">Employee</div><div class="value">${employee.name}</div></div>
          <div class="box"><div class="label">Designation</div><div class="value">${employee.role}</div></div>
          <div class="box"><div class="label">Department</div><div class="value">${employee.department}</div></div>
          <div class="box"><div class="label">Manager</div><div class="value">${employee.manager}</div></div>
        </div>

        <h2>Earnings</h2>
        <table><thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>${rows(breakdown)}</tbody></table>
        <h2>Deductions</h2>
        <table><thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>${rows(deductions, true)}</tbody></table>

        <div class="totals">
          <div class="total"><div class="label">Gross Pay</div><div class="value">${money(selected.gross, currency)}</div></div>
          <div class="total"><div class="label">Total Deductions</div><div class="value">${money(selected.deductions, currency)}</div></div>
          <div class="total net"><div class="label">Net Pay</div><div class="value">${money(selected.net, currency)}</div></div>
        </div>

        <div class="footer">
          Earnings breakdown total: ${money(earningsTotal, currency)} | Deductions breakdown total: ${money(deductionsTotal, currency)}.
          This computer-generated payslip is valid without a signature.
        </div>
      </div>
      <script>window.onload = () => setTimeout(() => window.print(), 150)</script>
    </body>
  </html>`
}

export default function EmployeePayroll() {
  const { employee: employeeRecord, loading: employeeLoading, isLinked } = useCurrentEmployee()
  const [myPayslips,  setMyPayslips]  = useState([])
  const [loadingPay,  setLoadingPay]  = useState(true)
  const [selected,    setSelected]    = useState(null)
  const [previewSlip, setPreviewSlip] = useState(null)

  const employee = {
    name:       employeeRecord?.name       || '',
    id:         employeeRecord?.id         || '',
    role:       employeeRecord?.role       || '',
    department: employeeRecord?.dept       || '',
    manager:    employeeRecord?.manager    || '',
  }

  useEffect(() => {
    if (!employeeRecord?.id) return
    setLoadingPay(true)
    payrollApi.employee(employeeRecord.id)
      .then(res => {
        const slips = res.data || []
        setMyPayslips(slips)
        if (slips.length) setSelected(slips[0])
      })
      .catch(console.error)
      .finally(() => setLoadingPay(false))
  }, [employeeRecord?.id])

  if (employeeLoading) return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /> Loading...</div>
  if (!isLinked) return <div className="card p-8 text-center text-sm text-gray-500">No linked employee record found for this account. Please ask HR to link your employee profile.</div>

  const buildBreakdown = (slip) => [
    { name: 'Basic Salary', amount: slip?.basic || 0 },
    { name: 'Allowances', amount: slip?.allowances || 0 },
    { name: 'Overtime', amount: slip?.overtime || 0 },
    { name: 'Bonus', amount: slip?.bonus || 0 },
    { name: 'Reimbursements', amount: slip?.reimbursements || 0 },
  ].filter(item => item.amount > 0)

  const buildDeductions = (slip) => [
    { name: 'Income Tax', amount: slip?.tax || 0 },
    { name: 'Recurring Deductions', amount: slip?.recurringDeductions || 0 },
    { name: 'One-time Deductions', amount: slip?.oneTimeDeductions || 0 },
    { name: 'Unpaid Leave Deduction', amount: slip?.unpaidLeaveDeduction || 0 },
  ].filter(item => item.amount > 0)

  const breakdown = buildBreakdown(selected)

  const selectedTax = selected?.tax ?? 0
  const selectedDeductions = selected?.deductions ?? 0
  const selectedNet = selected?.net ?? 0

  const deductions = buildDeductions(selected)

  const pieData = [
    { name: 'Net Pay', value: selectedNet },
    { name: 'Tax', value: selectedTax },
    { name: 'Other Deductions', value: Math.max(0, selectedDeductions - selectedTax) },
  ]

  const downloadPayslip = (slip = selected) => {
    const win = window.open('', '_blank')
    win.document.write(buildPayslipHtml({ employee, selected: slip, breakdown: buildBreakdown(slip), deductions: buildDeductions(slip) }))
    win.document.close()
  }

  const emailPayslip = () => {
    if (!selected) return
    const subject = encodeURIComponent(`${selected.month} payslip`)
    const currency = selected.currency || 'LKR'
    const body = encodeURIComponent(
      `Hi ${employee.name},\n\nYour ${selected.month} payslip summary:\nGross: ${money(selected.gross, currency)}\nDeductions: ${money(selected.deductions, currency)}\nNet pay: ${money(selected.net, currency)}\n\nPlease log in to Fuchsius HRMS to view or download the full payslip.\n`
    )
    window.location.href = `mailto:${employeeRecord.email}?subject=${subject}&body=${body}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payroll"
        subtitle="View salary details, deductions, payment history and download complete payslips."
      />

      {loadingPay && (
        <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading payslips…
        </div>
      )}

      {!loadingPay && !selected && (
        <div className="card p-10 text-center text-sm text-gray-400">
          No payroll records found. Ask HR to run payroll for your account.
        </div>
      )}

      {!loadingPay && selected && (
        <>
          <div className="card p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-950 text-white flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Current Payslip</p>
            <h2 className="text-lg font-bold text-gray-900">{selected.month}</h2>
            <p className="text-sm text-gray-500">{employee.name} - {employee.id} - {employee.department}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary" onClick={emailPayslip}>
            <Mail className="w-4 h-4" />
            Email Payslip
          </button>
          <button className="btn-primary" onClick={() => downloadPayslip(selected)}>
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[ 
          ['Gross Salary', money(selected.gross, selected.currency), 'text-gray-900'],
          ['Total Deductions', `-${money(selected.deductions, selected.currency)}`, 'text-red-500'],
          ['Net Pay', money(selected.net, selected.currency), 'text-emerald-600'],
          ['Issued', selected.issued || selected.month, 'text-gray-900'],
        ].map(([label, value, color]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            {label === 'Issued' && <span className="badge-green mt-2">Paid</span>}
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {myPayslips.map(p => (
          <button
            key={p.month}
            onClick={() => setSelected(p)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition ${
              selected.month === p.month
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.month}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Salary Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Earnings</p>
              {breakdown.map(b => (
                <div key={b.name} className="flex justify-between py-1.5 text-sm border-b border-gray-50">
                  <span className="text-gray-600">{b.name}</span>
                  <span className="font-medium text-gray-800">{money(b.amount, selected.currency)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Deductions</p>
              {deductions.map(d => (
                <div key={d.name} className="flex justify-between py-1.5 text-sm border-b border-gray-50">
                  <span className="text-gray-600">{d.name}</span>
                  <span className="font-medium text-red-500">-{money(d.amount, selected.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Pay Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <RechartsPie>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => money(v, selected.currency)} />
              </RechartsPie>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payslip Includes</h3>
            <div className="space-y-3">
              {[
                [FileText, 'Employee and pay period details'],
                [DollarSign, 'Earnings and deductions breakdown'],
                [Landmark, 'Bank transfer and payment reference'],
                [ShieldCheck, 'Paid status and issue date'],
              ].map(([Icon, text]) => (
                <div key={text} className="flex items-center gap-2 text-sm text-gray-600">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Payment History</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr>{['Period', 'Gross', 'Deductions', 'Net', 'Issued', 'Status', 'Actions'].map(h => <th key={h} className="table-head py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {myPayslips.map((p) => (
              <tr key={p.month} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{p.month}</td>
                <td className="table-cell">{money(p.gross, p.currency)}</td>
                <td className="table-cell text-red-500">-{money(p.deductions, p.currency)}</td>
                <td className="table-cell font-semibold text-emerald-600">{money(p.net, p.currency)}</td>
                <td className="table-cell text-xs text-gray-400">{p.issued}</td>
                <td className="table-cell"><span className="badge-green">Paid</span></td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost text-xs" onClick={() => { setSelected(p); setPreviewSlip(p) }}>
                      View
                    </button>
                    <button className="btn-ghost text-xs" onClick={() => downloadPayslip(p)}>
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!previewSlip} onClose={() => setPreviewSlip(null)} title="Payslip Preview" size="lg">
        {previewSlip && (
          <div className="space-y-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Fuchsius HRMS Payslip</p>
                  <h3 className="text-xl font-black text-gray-950">{previewSlip.month}</h3>
                  <p className="text-sm text-gray-500">{employee.name} - {employee.id} - {employee.role}</p>
                </div>
                <span className="badge-green">Paid on {previewSlip.issued}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Gross', money(previewSlip.gross, previewSlip.currency)],
                ['Tax', `-${money(previewSlip.tax, previewSlip.currency)}`],
                ['Deductions', `-${money(previewSlip.deductions, previewSlip.currency)}`],
                ['Net Pay', money(previewSlip.net, previewSlip.currency)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Earnings</h4>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  {buildBreakdown(previewSlip).map(item => (
                    <div key={item.name} className="flex justify-between px-3 py-2 text-sm border-b border-gray-100 last:border-0">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-semibold">{money(item.amount, previewSlip.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Deductions</h4>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  {[
                    ...buildDeductions(previewSlip),
                   ].map(item => (
                    <div key={item.name} className="flex justify-between px-3 py-2 text-sm border-b border-gray-100 last:border-0">
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-semibold text-red-500">-{money(item.amount, previewSlip.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button className="btn-secondary" onClick={() => setPreviewSlip(null)}>Close</button>
              <button className="btn-primary" onClick={() => downloadPayslip(previewSlip)}>
                <Download className="w-4 h-4" /> Download This Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>
        </>
      )} {/* end !loadingPay && selected */}
    </div>
  )
}
