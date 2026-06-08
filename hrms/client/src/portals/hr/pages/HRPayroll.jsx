import React, { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { payrollApi } from '../../../api/services'
import { exportRowsAsCsv, exportRowsAsPdf } from '../../../components/shared/exportUtils'
import { formatCurrency } from '../../../utils/currency'
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  Banknote, CheckCircle2, Download, FileText, Loader2,
  Pencil, Play, Settings, SlidersHorizontal, Users,
} from 'lucide-react'

const money = (value, currency = 'LKR') => formatCurrency(value, currency)

const numericFields = [
  'basic', 'allowances', 'overtime', 'bonus', 'reimbursements',
  'unpaidLeaveDeduction', 'recurringDeductions', 'oneTimeDeductions', 'tax',
]

const settingDefaults = {
  currency: 'LKR',
  payPeriod: 'Monthly',
  taxRate: 0.12,
  standardDeductionRate: 0.05,
  overtimeMultiplier: 1.5,
  unpaidLeaveDailyDivisor: 22,
}

const fieldLabels = {
  basicSalary: 'Basic salary',
  housingAllowance: 'Housing allowance',
  transportAllowance: 'Transport allowance',
  medicalAllowance: 'Medical allowance',
  recurringDeductions: 'Recurring deductions',
  overtimeHours: 'Overtime hours',
  overtimeRate: 'Overtime rate',
  bonus: 'Bonus',
  unpaidLeaveDays: 'Unpaid leave days',
  reimbursements: 'Reimbursements',
  oneTimeDeductions: 'One-time deductions',
  basic: 'Basic salary',
  allowances: 'Allowances',
  overtime: 'Overtime',
  unpaidLeaveDeduction: 'Unpaid leave deduction',
  tax: 'Tax',
}

const fieldHelp = {
  currency: 'Currency code used on payroll totals and payslips.',
  payPeriod: 'How often payroll is prepared for the company.',
  taxRate: 'Percentage applied to taxable gross pay during draft payroll calculation.',
  standardDeductionRate: 'Default deduction rate applied when employee recurring deductions are not set.',
  overtimeMultiplier: 'Multiplier used when overtime is calculated from employee salary.',
  unpaidLeaveDailyDivisor: 'Monthly salary divisor used to calculate unpaid leave deduction.',
  basicSalary: 'Employee fixed base pay for one payroll period. This becomes Basic Salary in the payroll run.',
  housingAllowance: 'Recurring housing allowance added to gross pay.',
  transportAllowance: 'Recurring transport allowance added to gross pay.',
  medicalAllowance: 'Recurring medical allowance added to gross pay.',
  recurringDeductions: 'Fixed recurring deductions such as loan, insurance, or provident deductions.',
  bankName: 'Bank used for salary transfer and payslip reference.',
  bankAccount: 'Employee salary transfer account number.',
  overtimeHours: 'Approved extra hours for this selected payroll month.',
  overtimeRate: 'Hourly overtime rate. If left as 0, backend can calculate from salary rules.',
  bonus: 'One-time bonus for this selected payroll month.',
  unpaidLeaveDays: 'Unpaid absence days. These reduce net pay through unpaid leave deduction.',
  reimbursements: 'Approved reimbursements paid back to employee this month.',
  oneTimeDeductions: 'One-time deductions for this month only, such as advances or penalties.',
  notes: 'Internal payroll note for why these variable inputs were added.',
  basic: 'Calculated or reviewed basic salary for this payroll record.',
  allowances: 'Total recurring allowances included in gross pay.',
  overtime: 'Total overtime amount included in gross pay.',
  unpaidLeaveDeduction: 'Deduction calculated from unpaid leave days.',
  tax: 'Tax amount deducted from gross pay.',
}

const toNumber = (value) => Number(value) || 0

const FieldInput = ({ label, help, value, onChange, type = 'number', className = '' }) => (
  <label className={`block ${className}`}>
    <span className="label">{label}</span>
    <input className="input" type={type} value={value ?? ''} onChange={onChange} />
    {help && <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{help}</span>}
  </label>
)

const MoneyCell = ({ value, currency, negative = false, className = '' }) => (
  <td className={`table-cell min-w-[9rem] whitespace-nowrap text-right font-medium tabular-nums ${className}`}>
    {negative ? '-' : ''}{money(value, currency)}
  </td>
)

const AttendanceImpactCell = ({ impact }) => (
  <td className="table-cell min-w-[12rem] text-xs text-gray-600">
    {impact ? (
      <div className="space-y-1">
        <p><span className="font-semibold text-gray-800">{impact.attendanceUnpaidDays || 0}</span> unpaid day eq.</p>
        <p>{impact.absentDays || 0} absent · {impact.approvedLeaveDays || 0} leave · {impact.lateMinutes || 0} late min · {impact.earlyLeaveMinutes || 0} early min</p>
      </div>
    ) : (
      <span className="text-gray-400">No attendance impact</span>
    )}
  </td>
)

export default function HRPayroll() {
  const { employees } = useHR()
  const [payrollRows, setPayrollRows] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [runMonth, setRunMonth] = useState('')
  const [settings, setSettings] = useState(settingDefaults)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [trend, setTrend] = useState([])
  const [activeRecord, setActiveRecord] = useState(null)
  const [compensation, setCompensation] = useState(null)
  const [variables, setVariables] = useState(null)
  const [review, setReview] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [inputOpen, setInputOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [saving, setSaving] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [bulkPaying, setBulkPaying] = useState(false)

  useEffect(() => {
    const now = new Date()
    const current = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    setSelectedMonth(current)
    setRunMonth(next)
  }, [])

  const refresh = async (month = selectedMonth) => {
    if (!month) return
    const [payrollRes, settingsRes, trendRes] = await Promise.all([
      payrollApi.list({ month }).catch(() => ({ data: [] })),
      payrollApi.settings().catch(() => ({ data: settingDefaults })),
      payrollApi.monthlyTrend().catch(() => ({ data: [] })),
    ])
    setPayrollRows(payrollRes.data || [])
    setSettings({ ...settingDefaults, ...(settingsRes.data || {}) })
    setTrend(trendRes.data || [])
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [selectedMonth])

  const totals = useMemo(() => payrollRows.reduce((sum, p) => ({
    gross: sum.gross + (p.gross || 0),
    net: sum.net + (p.net || 0),
    tax: sum.tax + (p.tax || 0),
    deductions: sum.deductions + (p.deductions || 0),
  }), { gross: 0, net: 0, tax: 0, deductions: 0 }), [payrollRows])

  const exportRows = payrollRows.map(p => ({
    Employee: p.name,
    Department: p.dept,
    Month: p.month,
    Basic: money(p.basic, p.currency),
    Allowances: money(p.allowances, p.currency),
    Variables: money((p.overtime || 0) + (p.bonus || 0) + (p.reimbursements || 0), p.currency),
    AttendanceUnpaidDays: p.attendanceImpact?.attendanceUnpaidDays || 0,
    ApprovedLeaveDays: p.attendanceImpact?.approvedLeaveDays || 0,
    LateMinutes: p.attendanceImpact?.lateMinutes || 0,
    EarlyLeaveMinutes: p.attendanceImpact?.earlyLeaveMinutes || 0,
    Deductions: money(p.deductions, p.currency),
    Net: money(p.net, p.currency),
    Status: p.status,
  }))

  const openCompensation = async (record) => {
    setActiveRecord(record)
    const res = await payrollApi.compensation(record.empId)
    setCompensation(res.data)
  }

  const openCompensationForEmployee = async (employeeId = selectedEmployeeId) => {
    const emp = employees.find(e => e.id === employeeId)
    if (!emp) return
    setActiveRecord({ empId: emp.id, name: emp.name })
    const res = await payrollApi.compensation(emp.id)
    setCompensation(res.data)
    setSetupOpen(false)
  }

  const openVariables = async (record) => {
    setActiveRecord(record)
    const res = await payrollApi.variables(record.empId, selectedMonth)
    setVariables(res.data)
  }

  const openVariablesForEmployee = async (employeeId = selectedEmployeeId) => {
    const emp = employees.find(e => e.id === employeeId)
    if (!emp || !selectedMonth) return
    setActiveRecord({ empId: emp.id, name: emp.name })
    const res = await payrollApi.variables(emp.id, selectedMonth)
    setVariables(res.data)
    setInputOpen(false)
  }

  const saveSettings = async () => {
    setSettingsSaving(true)
    try {
      const res = await payrollApi.updateSettings(settings)
      setSettings(res.data)
      setSettingsOpen(false)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSettingsSaving(false)
    }
  }

  const runDraftPayroll = async () => {
    setRunLoading(true)
    try {
      await payrollApi.run(runMonth)
      setSelectedMonth(runMonth)
      await refresh(runMonth)
      setRunOpen(false)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setRunLoading(false)
    }
  }

  const saveCompensation = async () => {
    setSaving(true)
    try {
      await payrollApi.updateCompensation(activeRecord.empId, compensation)
      await payrollApi.run(selectedMonth)
      await refresh()
      setCompensation(null)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveVariables = async () => {
    setSaving(true)
    try {
      await payrollApi.updateVariables(activeRecord.empId, selectedMonth, variables)
      await payrollApi.run(selectedMonth)
      await refresh()
      setVariables(null)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveReview = async () => {
    setSaving(true)
    try {
      await payrollApi.updateRecord(review.id, review)
      await refresh()
      setReview(null)
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const decide = async (record, action) => {
    setSaving(true)
    try {
      if (action === 'approve') await payrollApi.approve(record.id)
      if (action === 'pay') await payrollApi.pay(record.id)
      await refresh()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  const payAllApproved = async () => {
    if (!approvedCount) return
    const confirmed = window.confirm(`Mark all ${approvedCount} approved payroll records as paid for ${selectedMonth}? This will notify employees and prepare payslip PDF emails.`)
    if (!confirmed) return
    setBulkPaying(true)
    try {
      await payrollApi.payApproved(selectedMonth)
      await refresh()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setBulkPaying(false)
    }
  }

  const approveAllDrafts = async () => {
    if (!draftCount) return
    const confirmed = window.confirm(`Approve all ${draftCount} draft payroll records for ${selectedMonth}?`)
    if (!confirmed) return
    setBulkApproving(true)
    try {
      await payrollApi.approveDrafts(selectedMonth)
      await refresh()
    } catch (err) {
      alert(err.response?.data?.error || err.message)
    } finally {
      setBulkApproving(false)
    }
  }

  const exportPayslip = (p) => exportRowsAsPdf({
    title: `${p.name} Payslip`,
    subtitle: `${p.month} payroll statement`,
    filename: `${p.name}-${p.month}-payslip.pdf`,
    rows: [{
      Basic: money(p.basic, p.currency),
      Allowances: money(p.allowances, p.currency),
      Overtime: money(p.overtime, p.currency),
      Bonus: money(p.bonus, p.currency),
      Reimbursements: money(p.reimbursements, p.currency),
      Tax: money(p.tax, p.currency),
      Deductions: money(p.deductions, p.currency),
      Net: money(p.net, p.currency),
      Status: p.status,
    }],
  })

  const setSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))
  const setComp = (key, value) => setCompensation(prev => ({ ...prev, [key]: value }))
  const setVar = (key, value) => setVariables(prev => ({ ...prev, [key]: value }))
  const setReviewField = (key, value) => setReview(prev => ({ ...prev, [key]: value }))
  const activeEmployees = employees.filter(e => e.status === 'Active')
  const draftCount = payrollRows.filter(p => p.status === 'Draft').length
  const approvedCount = payrollRows.filter(p => p.status === 'Approved').length
  const paidCount = payrollRows.filter(p => p.status === 'Paid').length
  const compensationPreview = compensation ? {
    basic: toNumber(compensation.basicSalary),
    allowances: toNumber(compensation.housingAllowance) + toNumber(compensation.transportAllowance) + toNumber(compensation.medicalAllowance),
    recurringDeductions: toNumber(compensation.recurringDeductions),
  } : null
  const variablePreview = variables ? {
    additions: (toNumber(variables.overtimeHours) * toNumber(variables.overtimeRate)) + toNumber(variables.bonus) + toNumber(variables.reimbursements),
    deductions: toNumber(variables.oneTimeDeductions),
    unpaidDays: toNumber(variables.unpaidLeaveDays),
  } : null
  const reviewPreview = review ? {
    gross: toNumber(review.basic) + toNumber(review.allowances) + toNumber(review.overtime) + toNumber(review.bonus) + toNumber(review.reimbursements),
    deductions: toNumber(review.tax) + toNumber(review.unpaidLeaveDeduction) + toNumber(review.recurringDeductions) + toNumber(review.oneTimeDeductions),
  } : null
  const reviewNet = reviewPreview ? Math.max(0, reviewPreview.gross - reviewPreview.deductions) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Administration"
        subtitle="Set pay rules, prepare draft payroll, review employee inputs, approve, mark paid, and publish payslips."
        actions={
          <>
            <button className="btn-secondary text-xs" onClick={() => exportRowsAsCsv('fuchsius-hrms-payroll.csv', exportRows)}>
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button className="btn-secondary text-xs" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-3.5 h-3.5" /> Settings
            </button>
            <button className="btn-secondary text-xs" onClick={() => { setSelectedEmployeeId(activeEmployees[0]?.id || ''); setSetupOpen(true) }}>
              <Users className="w-3.5 h-3.5" /> Compensation
            </button>
            <button className="btn-secondary text-xs" onClick={() => { setSelectedEmployeeId(activeEmployees[0]?.id || ''); setInputOpen(true) }}>
              <SlidersHorizontal className="w-3.5 h-3.5" /> Inputs
            </button>
            <button className="btn-secondary text-xs" onClick={approveAllDrafts} disabled={!draftCount || bulkApproving}>
              {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve All Draft
            </button>
            <button className="btn-secondary text-xs" onClick={payAllApproved} disabled={!approvedCount || bulkPaying}>
              {bulkPaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Pay All Approved
            </button>
            <button className="btn-primary" onClick={() => setRunOpen(true)}>
              <Play className="w-4 h-4" /> Run Payroll
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['Gross Payroll', totals.gross, 'bg-gray-900 text-white'],
          ['Net Payout', totals.net, 'bg-emerald-600 text-white'],
          ['Tax', totals.tax, 'bg-white text-gray-900'],
          ['All Deductions', totals.deductions, 'bg-white text-gray-900'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`card p-4 ${tone}`}>
            <p className="text-xs opacity-70 mb-1">{label}</p>
            <p className="text-xl font-bold">{money(value, settings.currency)}</p>
            <p className="text-[11px] opacity-60 mt-1">{selectedMonth || 'Selected period'}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">Active Employees</p>
            <p className="font-bold text-gray-900">{activeEmployees.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Draft</p>
            <p className="font-bold text-gray-900">{draftCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Approved</p>
            <p className="font-bold text-amber-600">{approvedCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Paid</p>
            <p className="font-bold text-emerald-600">{paidCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Payroll Trend</h3>
            <input className="input text-xs w-40" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="June 2026" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={trend} barSize={18}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => money(v, settings.currency)} />
              <Bar dataKey="gross" fill="#111827" radius={[4, 4, 0, 0]} name="Gross" />
              <Bar dataKey="net" fill="#10b981" radius={[4, 4, 0, 0]} name="Net" />
              <Bar dataKey="tax" fill="#9ca3af" radius={[4, 4, 0, 0]} name="Tax" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Current Rules</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Currency</span><b>{settings.currency}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Period</span><b>{settings.payPeriod}</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><b>{Number(settings.taxRate * 100).toFixed(1)}%</b></div>
            <div className="flex justify-between"><span className="text-gray-500">OT multiplier</span><b>{settings.overtimeMultiplier}x</b></div>
            <div className="flex justify-between"><span className="text-gray-500">Unpaid leave divisor</span><b>{settings.unpaidLeaveDailyDivisor}</b></div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{selectedMonth} Payroll Run</h3>
          <span className="badge-gray">{payrollRows.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-left">
            <thead>
              <tr>
                <th className="table-head min-w-[190px]">Employee</th>
                {['Basic','Allowances','Variables'].map(h => (
                  <th key={h} className="table-head min-w-[9rem] text-right">{h}</th>
                ))}
                <th className="table-head min-w-[12rem]">Attendance</th>
                {['Deductions','Tax','Net'].map(h => (
                  <th key={h} className="table-head min-w-[9rem] text-right">{h}</th>
                ))}
                <th className="table-head min-w-[7rem]">Status</th>
                <th className="table-head min-w-[22rem]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollRows.map(p => {
                const variablesTotal = (p.overtime || 0) + (p.bonus || 0) + (p.reimbursements || 0)
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.dept}</p>
                    </td>
                    <MoneyCell value={p.basic} currency={p.currency} />
                    <MoneyCell value={p.allowances} currency={p.currency} />
                    <MoneyCell value={variablesTotal} currency={p.currency} className="text-emerald-600" />
                    <AttendanceImpactCell impact={p.attendanceImpact} />
                    <MoneyCell value={p.deductions} currency={p.currency} negative className="text-red-500" />
                    <MoneyCell value={p.tax} currency={p.currency} negative className="text-gray-500" />
                    <MoneyCell value={p.net} currency={p.currency} className="font-semibold text-gray-900" />
                    <td className="table-cell">
                      <span className={p.status === 'Paid' ? 'badge-green' : p.status === 'Approved' ? 'badge-yellow' : 'badge-gray'}>{p.status}</span>
                    </td>
                    <td className="table-cell min-w-[22rem]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button className="btn-ghost text-xs" title="Compensation structure" onClick={() => openCompensation(p)}><Banknote className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost text-xs" title="Variable inputs" onClick={() => openVariables(p)}><SlidersHorizontal className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost text-xs" title="Review/edit record" onClick={() => setReview({ ...p })}><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost text-xs" title="Export payslip" onClick={() => exportPayslip(p)}><FileText className="w-3.5 h-3.5" /></button>
                        <button className="btn-ghost text-xs" disabled={p.status !== 'Draft' || saving} onClick={() => decide(p, 'approve')}><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                        <button className="btn-primary text-xs" disabled={p.status !== 'Approved' || saving} onClick={() => decide(p, 'pay')}>Mark paid</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {payrollRows.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400">No payroll run exists for this period. Prepare a draft payroll to begin review.</div>
        )}
      </div>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Payroll Settings">
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          These rules are used when HR prepares a draft payroll. Employee compensation and monthly inputs are calculated using these settings.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput label="Currency" help={fieldHelp.currency} type="text" value={settings.currency} onChange={e => setSetting('currency', e.target.value.toUpperCase())} />
          <FieldInput label="Pay period" help={fieldHelp.payPeriod} type="text" value={settings.payPeriod} onChange={e => setSetting('payPeriod', e.target.value)} />
          <FieldInput label="Tax rate" help={fieldHelp.taxRate} value={settings.taxRate} onChange={e => setSetting('taxRate', e.target.value)} />
          <FieldInput label="Standard deduction rate" help={fieldHelp.standardDeductionRate} value={settings.standardDeductionRate} onChange={e => setSetting('standardDeductionRate', e.target.value)} />
          <FieldInput label="Overtime multiplier" help={fieldHelp.overtimeMultiplier} value={settings.overtimeMultiplier} onChange={e => setSetting('overtimeMultiplier', e.target.value)} />
          <FieldInput label="Unpaid leave divisor" help={fieldHelp.unpaidLeaveDailyDivisor} value={settings.unpaidLeaveDailyDivisor} onChange={e => setSetting('unpaidLeaveDailyDivisor', e.target.value)} />
        </div>
        <button className="btn-primary w-full mt-4" onClick={saveSettings} disabled={settingsSaving}>
          {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Settings
        </button>
      </Modal>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Run Payroll">
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            This creates or refreshes draft payroll from compensation structures, variable payroll inputs, and current payroll settings. Already paid records for this period are protected and will not be overwritten.
          </div>
          <input className="input" value={runMonth} onChange={e => setRunMonth(e.target.value)} placeholder="June 2026" />
          <button className="btn-primary w-full" onClick={runDraftPayroll} disabled={runLoading}>
            {runLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Prepare Draft Payroll
          </button>
        </div>
      </Modal>

      <Modal open={setupOpen} onClose={() => setSetupOpen(false)} title="Compensation Setup">
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            Set base salary, allowances, recurring deductions and bank details before preparing payroll.
          </div>
          <select className="select" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}>
            {activeEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} - {emp.role}</option>
            ))}
          </select>
          <button className="btn-primary w-full" onClick={() => openCompensationForEmployee()}>Open Compensation Structure</button>
        </div>
      </Modal>

      <Modal open={inputOpen} onClose={() => setInputOpen(false)} title="Variable Payroll Inputs">
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            Add overtime, bonus, reimbursements, unpaid leave and one-time deductions for the selected pay period before drafting payroll.
          </div>
          <input className="input" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} placeholder="June 2026" />
          <select className="select" value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}>
            {activeEmployees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} - {emp.role}</option>
            ))}
          </select>
          <button className="btn-primary w-full" onClick={() => openVariablesForEmployee()}>Open Variable Inputs</button>
        </div>
      </Modal>

      <Modal open={Boolean(compensation)} onClose={() => setCompensation(null)} title={`Compensation - ${activeRecord?.name || ''}`}>
        {compensation && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Compensation is the employee's recurring pay structure. It is used every month unless HR changes it.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['basicSalary','housingAllowance','transportAllowance','medicalAllowance','recurringDeductions'].map(key => (
                <FieldInput key={key} label={fieldLabels[key]} help={fieldHelp[key]} value={compensation[key] || 0} onChange={e => setComp(key, e.target.value)} />
              ))}
              <FieldInput label="Bank name" help={fieldHelp.bankName} type="text" value={compensation.bankName || ''} onChange={e => setComp('bankName', e.target.value)} />
              <FieldInput label="Bank account" help={fieldHelp.bankAccount} type="text" value={compensation.bankAccount || ''} onChange={e => setComp('bankAccount', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div><p className="text-xs text-gray-400">Basic</p><p className="font-bold">{money(compensationPreview.basic, settings.currency)}</p></div>
              <div><p className="text-xs text-gray-400">Allowances</p><p className="font-bold text-emerald-600">{money(compensationPreview.allowances, settings.currency)}</p></div>
              <div><p className="text-xs text-gray-400">Recurring deductions</p><p className="font-bold text-red-500">-{money(compensationPreview.recurringDeductions, settings.currency)}</p></div>
            </div>
            <button className="btn-primary w-full" onClick={saveCompensation} disabled={saving}>Save and Recalculate Payroll</button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(variables)} onClose={() => setVariables(null)} title={`Variable Inputs - ${activeRecord?.name || ''}`}>
        {variables && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Variable inputs apply only to <strong>{selectedMonth}</strong>. Use this for monthly changes such as overtime, bonus, unpaid leave, reimbursements, and one-time deductions.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['overtimeHours','overtimeRate','bonus','unpaidLeaveDays','reimbursements','oneTimeDeductions'].map(key => (
                <FieldInput key={key} label={fieldLabels[key]} help={fieldHelp[key]} value={variables[key] || 0} onChange={e => setVar(key, e.target.value)} />
              ))}
              <label className="block sm:col-span-2">
                <span className="label">Payroll notes</span>
                <textarea className="input" rows={3} value={variables.notes || ''} onChange={e => setVar('notes', e.target.value)} />
                <span className="mt-1 block text-[11px] leading-relaxed text-gray-500">{fieldHelp.notes}</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div><p className="text-xs text-gray-400">Variable additions</p><p className="font-bold text-emerald-600">{money(variablePreview.additions, settings.currency)}</p></div>
              <div><p className="text-xs text-gray-400">One-time deductions</p><p className="font-bold text-red-500">-{money(variablePreview.deductions, settings.currency)}</p></div>
              <div><p className="text-xs text-gray-400">Unpaid days</p><p className="font-bold">{variablePreview.unpaidDays}</p></div>
            </div>
            <button className="btn-primary w-full" onClick={saveVariables} disabled={saving}>Save and Recalculate Payroll</button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(review)} onClose={() => setReview(null)} title={`Review Payroll - ${review?.name || ''}`}>
        {review && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              This is the final payroll record for this employee and month. Editing these values overrides calculated payroll and moves the record back to Draft for review.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {numericFields.map(key => (
                <FieldInput key={key} label={fieldLabels[key] || key} help={fieldHelp[key]} value={review[key] || 0} onChange={e => setReviewField(key, e.target.value)} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div><p className="text-xs text-gray-400">Gross pay</p><p className="font-bold">{money(reviewPreview.gross, review.currency)}</p></div>
              <div><p className="text-xs text-gray-400">Total deductions</p><p className="font-bold text-red-500">-{money(reviewPreview.deductions, review.currency)}</p></div>
              <div><p className="text-xs text-gray-400">Net pay</p><p className="font-bold text-emerald-600">{money(reviewNet, review.currency)}</p></div>
            </div>
            <button className="btn-primary w-full" onClick={saveReview} disabled={saving}>Save Reviewed Payroll</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
