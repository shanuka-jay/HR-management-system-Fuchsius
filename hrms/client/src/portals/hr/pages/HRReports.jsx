import React, { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, FileText, BarChart2 } from 'lucide-react'
import { useHR } from '../../../context/HRContext'
import { exportRowsAsCsv, exportRowsAsPdf } from '../../../components/shared/exportUtils'
import { reportsApi } from '../../../api/services'
import { formatCurrency, formatCurrencyShort } from '../../../utils/currency'

const COLORS = ['#1a1a1a','#f59e0b','#d1d1d1']

const todayIso = () => new Date().toISOString().slice(0, 10)
const monthStartIso = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const groupByShift = (rows) => rows.reduce((groups, row) => {
  const shift = row.Shift || 'Unassigned Shift'
  if (!groups[shift]) groups[shift] = []
  groups[shift].push(row)
  return groups
}, {})

const exportAttendanceByShiftPdf = ({ rows, subtitle, filename }) => {
  if (!rows.length) return
  const groups = groupByShift(rows)
  const headers = ['Employee','Department','Date','CheckIn','CheckOut','Hours','LateMinutes','EarlyLeaveMinutes','ShiftResult','Status']
  const groupHtml = Object.entries(groups).map(([shift, items]) => {
    const totalLate = items.reduce((sum, row) => sum + (Number(row.LateMinutes) || 0), 0)
    const completed = items.filter(row => row.ShiftResult === 'Completed Shift').length
    const early = items.filter(row => Number(row.EarlyLeaveMinutes) > 0).length
    const body = items.map(row =>
      `<tr>${headers.map(header => `<td>${String(row[header] ?? '')}</td>`).join('')}</tr>`
    ).join('')
    return `
      <section>
        <h2>${shift}</h2>
        <div class="summary">
          <span>${items.length} records</span>
          <span>${completed} completed</span>
          <span>${early} early leaves</span>
          <span>${totalLate} late min</span>
        </div>
        <table>
          <thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </section>
    `
  }).join('')
  const html = `<!doctype html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body { font-family: Inter, Arial, sans-serif; color:#111827; padding:32px; }
          .brand { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#6b7280; font-weight:800; }
          h1 { margin:6px 0 4px; font-size:24px; }
          h2 { margin:28px 0 8px; font-size:16px; }
          p { margin:0 0 18px; color:#6b7280; font-size:13px; }
          .summary { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 10px; }
          .summary span { border:1px solid #e5e7eb; background:#f9fafb; border-radius:8px; padding:6px 10px; font-size:11px; color:#374151; font-weight:700; }
          table { border-collapse: collapse; width:100%; border:1px solid #d1d5db; margin-bottom:18px; }
          th { background:#111827; color:white; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.06em; padding:8px; }
          td { border-top:1px solid #e5e7eb; padding:8px; font-size:11px; }
          tr:nth-child(even) td { background:#f9fafb; }
          section { break-inside: avoid; }
          .footer { margin-top:18px; font-size:11px; color:#6b7280; }
          @media print { body { padding:18px; } }
        </style>
      </head>
      <body>
        <div class="brand">Fuchsius HRMS</div>
        <h1>Attendance Report by Shift</h1>
        <p>${subtitle}</p>
        ${groupHtml}
        <div class="footer">Generated ${new Date().toLocaleString()}</div>
        <script>window.onload = () => setTimeout(() => window.print(), 150)</script>
      </body>
    </html>`
  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

export default function HRReports() {
  const { employees, leaveRequests, payrollData, attendanceToday, performanceReviews } = useHR()
  const [reportType, setReportType] = useState('all')
  const [deptHeadcount, setDeptHeadcount] = useState([])
  const [statusData, setStatusData] = useState([])
  const [payrollMonthly, setPayrollMonthly] = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState([])
  const [backendRows, setBackendRows] = useState([])
  const [attendanceFilters, setAttendanceFilters] = useState({
    dateFrom: monthStartIso(),
    dateTo: todayIso(),
    shift: 'All',
  })
  const [reportFilters, setReportFilters] = useState({
    department: 'All',
    employeeId: 'All',
    status: 'All',
    month: 'All',
    leaveType: 'All',
    cycle: 'All',
    ratingMin: '',
    ratingMax: '',
  })

  const departments = ['All', ...Array.from(new Set(employees.map(e => e.dept).filter(Boolean)))]
  const payrollMonths = ['All', ...Array.from(new Set(payrollData.map(p => p.month).filter(Boolean)))]
  const leaveTypes = ['All', ...Array.from(new Set(leaveRequests.map(l => l.type).filter(Boolean)))]
  const cycles = ['All', ...Array.from(new Set(performanceReviews.map(r => r.period).filter(Boolean)))]
  const statusOptions = {
    all: ['All', 'Active', 'On Leave', 'Inactive'],
    payroll: ['All', 'Draft', 'Approved', 'Paid'],
    attendance: ['All', 'Present', 'Late', 'Absent'],
    leave: ['All', ...Array.from(new Set(leaveRequests.map(l => l.status).filter(Boolean)))],
    performance: ['All', ...Array.from(new Set(performanceReviews.map(r => r.status).filter(Boolean)))],
  }
  const setReportFilter = (key, value) => setReportFilters(prev => ({ ...prev, [key]: value }))
  const exportParams = () => {
    const params = {}
    if (reportFilters.department !== 'All') params.department = reportFilters.department
    if (reportFilters.employeeId !== 'All') params.employeeId = reportFilters.employeeId
    if (reportFilters.status !== 'All') params.status = reportFilters.status
    if (reportType === 'payroll' && reportFilters.month !== 'All') params.month = reportFilters.month
    if (reportType === 'attendance') {
      if (attendanceFilters.dateFrom) params.dateFrom = attendanceFilters.dateFrom
      if (attendanceFilters.dateTo) params.dateTo = attendanceFilters.dateTo
      if (attendanceFilters.shift !== 'All') params.shift = attendanceFilters.shift
    }
    if (reportType === 'leave') {
      if (attendanceFilters.dateFrom) params.dateFrom = attendanceFilters.dateFrom
      if (attendanceFilters.dateTo) params.dateTo = attendanceFilters.dateTo
      if (reportFilters.leaveType !== 'All') params.leaveType = reportFilters.leaveType
    }
    if (reportType === 'performance') {
      if (reportFilters.cycle !== 'All') params.cycle = reportFilters.cycle
      if (reportFilters.ratingMin) params.ratingMin = reportFilters.ratingMin
      if (reportFilters.ratingMax) params.ratingMax = reportFilters.ratingMax
    }
    return params
  }

  useEffect(() => {
    reportsApi.analytics().then(r => {
      setDeptHeadcount((r.data.deptHeadcount || []).map(d => ({ ...d, name: d.name.split(' ')[0] })))
      setStatusData(r.data.status || [])
      setPayrollMonthly(r.data.payroll || [])
      setAttendanceSummary(r.data.attendance || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setBackendRows([])
    setReportFilters(prev => ({
      ...prev,
      status: 'All',
      month: 'All',
      leaveType: 'All',
      cycle: 'All',
      ratingMin: '',
      ratingMax: '',
    }))
  }, [reportType])

  useEffect(() => {
    const type = reportType === 'all' ? 'employees' : reportType
    const params = exportParams()
    reportsApi.exportRows(type, params).then(r => setBackendRows(r.data || [])).catch(() => setBackendRows([]))
  }, [
    reportType,
    attendanceFilters.dateFrom,
    attendanceFilters.dateTo,
    attendanceFilters.shift,
    reportFilters.department,
    reportFilters.employeeId,
    reportFilters.status,
    reportFilters.month,
    reportFilters.leaveType,
    reportFilters.cycle,
    reportFilters.ratingMin,
    reportFilters.ratingMax,
  ])

  const reportRows = {
    all: employees.map(e => ({
      ID: e.id,
      Employee: e.name,
      Department: e.dept,
      Role: e.role,
      Status: e.status,
      Manager: e.manager,
      Salary: formatCurrency(e.salary),
    })),
    payroll: payrollData.map(p => ({
      Employee: p.name,
      Department: p.dept,
      Month: p.month,
      Gross: formatCurrency(p.gross, p.currency),
      Deductions: formatCurrency(p.deductions, p.currency),
      Net: formatCurrency(p.net, p.currency),
      Status: p.status,
    })),
    attendance: attendanceToday.map(a => ({
      Employee: a.name,
      Shift: a.shift,
      ShiftStart: a.shiftStart,
      ShiftEnd: a.shiftEnd,
      CheckIn: a.checkIn,
      CheckOut: a.checkOut,
      Hours: a.hours,
      LateMinutes: a.lateMinutes,
      EarlyLeaveMinutes: a.earlyLeaveMinutes,
      ShiftResult: a.shiftResult,
      Status: a.status,
    })),
    leave: leaveRequests.map(l => ({
      Employee: l.employee,
      Type: l.type,
      From: l.start,
      To: l.end,
      Days: l.days,
      Status: l.status,
    })),
    performance: performanceReviews.map(r => ({
      Employee: r.employee,
      Period: r.period,
      Reviewer: r.reviewer,
      Goals: `${r.completed}/${r.goals}`,
      Rating: r.rating || 'Pending',
      Status: r.status,
    })),
  }
  const currentRows = backendRows
  const filteredDeptHeadcount = useMemo(() => {
    if (reportType !== 'all') return deptHeadcount
    const byDept = new Map()
    currentRows.forEach(row => byDept.set(row.Department || 'Unknown', (byDept.get(row.Department || 'Unknown') || 0) + 1))
    return Array.from(byDept.entries()).map(([name, count]) => ({ name: name.split(' ')[0], count }))
  }, [reportType, currentRows, deptHeadcount])
  const filteredStatusData = useMemo(() => {
    if (reportType !== 'all') return statusData
    const byStatus = new Map()
    currentRows.forEach(row => byStatus.set(row.Status || 'Unknown', (byStatus.get(row.Status || 'Unknown') || 0) + 1))
    return Array.from(byStatus.entries()).map(([name, value]) => ({ name, value }))
  }, [reportType, currentRows, statusData])
  const filteredPayrollTrend = useMemo(() => {
    if (reportType !== 'payroll') return payrollMonthly
    const byMonth = new Map()
    currentRows.forEach(row => {
      const month = row.Month || 'Unknown'
      if (!byMonth.has(month)) byMonth.set(month, { month, gross: 0, net: 0 })
      const item = byMonth.get(month)
      item.gross += Number(row.Gross || 0)
      item.net += Number(row.Net || 0)
    })
    return Array.from(byMonth.values())
  }, [reportType, currentRows, payrollMonthly])
  const filteredAttendanceTrend = useMemo(() => {
    if (reportType !== 'attendance') return attendanceSummary
    const byDate = new Map()
    currentRows.forEach(row => {
      const month = row.Date || 'Unknown'
      if (!byDate.has(month)) byDate.set(month, { month, present: 0, absent: 0, late: 0, completed: 0, earlyLeave: 0, lateMinutes: 0 })
      const item = byDate.get(month)
      if (row.Status === 'Absent') item.absent += 1
      else if (row.Status === 'Late') item.late += 1
      else item.present += 1
      if (row.ShiftResult === 'Completed Shift') item.completed += 1
      if (Number(row.EarlyLeaveMinutes) > 0) item.earlyLeave += 1
      item.lateMinutes += Number(row.LateMinutes || 0)
    })
    return Array.from(byDate.values()).sort((a, b) => String(a.month).localeCompare(String(b.month)))
  }, [reportType, currentRows, attendanceSummary])
  const attendanceShiftGroups = reportType === 'attendance' ? groupByShift(currentRows) : {}
  const shiftOptions = ['All', ...Array.from(new Set([
    attendanceFilters.shift !== 'All' ? attendanceFilters.shift : null,
    ...backendRows.map(row => row.Shift).filter(Boolean),
    ...attendanceToday.map(row => row.shift).filter(Boolean),
  ].filter(Boolean)))]
  const reportLabel = {
    all: 'Employee Headcount',
    payroll: 'Payroll Summary',
    attendance: 'Attendance Report',
    leave: 'Leave Summary',
    performance: 'Performance Summary',
  }[reportType]

  const attendanceSubtitle = `Date range ${attendanceFilters.dateFrom || 'start'} to ${attendanceFilters.dateTo || 'end'}${attendanceFilters.shift !== 'All' ? `, ${attendanceFilters.shift}` : ', grouped by shift'}.`
  const exportCsv = () => {
    const rows = reportType === 'attendance'
      ? [...currentRows].sort((a, b) => String(a.Shift).localeCompare(String(b.Shift)) || String(a.Date).localeCompare(String(b.Date)) || String(a.Employee).localeCompare(String(b.Employee)))
      : currentRows
    exportRowsAsCsv(`Fuchsius HRMS-${reportType}-report.csv`, rows)
  }
  const exportPdf = () => {
    if (reportType === 'attendance') {
      exportAttendanceByShiftPdf({
        rows: currentRows,
        subtitle: attendanceSubtitle,
        filename: `Fuchsius HRMS-attendance-by-shift-report.pdf`,
      })
      return
    }
    exportRowsAsPdf({
      title: reportLabel,
      subtitle: 'Structured HR analytics export from Fuchsius HRMS.',
      filename: `Fuchsius HRMS-${reportType}-report.pdf`,
      rows: currentRows,
    })
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Data-driven insights for HR decision making"
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs" onClick={exportCsv}><Download className="w-3.5 h-3.5" /> CSV</button>
            <button className="btn-primary text-xs" onClick={exportPdf}><FileText className="w-3.5 h-3.5" /> Export PDF</button>
          </div>
        }
      />

      <div className="card p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Export Builder</h3>
            <p className="text-xs text-gray-500">Choose a report, then export it as CSV or a print-ready PDF table.</p>
          </div>
          <select className="select max-w-xs" value={reportType} onChange={e => setReportType(e.target.value)}>
            <option value="all">Employee Headcount</option>
            <option value="payroll">Payroll Summary</option>
            <option value="attendance">Attendance Report</option>
            <option value="leave">Leave Summary</option>
            <option value="performance">Performance Summary</option>
          </select>
        </div>
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label>
              <span className="label">Department</span>
              <select className="select" value={reportFilters.department} onChange={e => setReportFilter('department', e.target.value)}>
                {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Employee</span>
              <select className="select" value={reportFilters.employeeId} onChange={e => setReportFilter('employeeId', e.target.value)}>
                <option value="All">All Employees</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Status</span>
              <select className="select" value={reportFilters.status} onChange={e => setReportFilter('status', e.target.value)}>
                {(statusOptions[reportType] || statusOptions.all).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            {reportType === 'payroll' && (
              <label>
                <span className="label">Payroll Month</span>
                <select className="select" value={reportFilters.month} onChange={e => setReportFilter('month', e.target.value)}>
                  {payrollMonths.map(month => <option key={month} value={month}>{month}</option>)}
                </select>
              </label>
            )}
            {(reportType === 'attendance' || reportType === 'leave') && (
              <>
                <label>
                  <span className="label">From Date</span>
                  <input
                    className="input"
                    type="date"
                    value={attendanceFilters.dateFrom}
                    onChange={e => setAttendanceFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                  />
                </label>
                <label>
                  <span className="label">To Date</span>
                  <input
                    className="input"
                    type="date"
                    value={attendanceFilters.dateTo}
                    onChange={e => setAttendanceFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                  />
                </label>
              </>
            )}
            {reportType === 'attendance' && (
              <label>
                <span className="label">Shift</span>
                <select
                  className="select"
                  value={attendanceFilters.shift}
                  onChange={e => setAttendanceFilters(prev => ({ ...prev, shift: e.target.value }))}
                >
                  {shiftOptions.map(shift => <option key={shift} value={shift}>{shift}</option>)}
                </select>
              </label>
            )}
            {reportType === 'leave' && (
              <label>
                <span className="label">Leave Type</span>
                <select className="select" value={reportFilters.leaveType} onChange={e => setReportFilter('leaveType', e.target.value)}>
                  {leaveTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
            )}
            {reportType === 'performance' && (
              <>
                <label>
                  <span className="label">Review Cycle</span>
                  <select className="select" value={reportFilters.cycle} onChange={e => setReportFilter('cycle', e.target.value)}>
                    {cycles.map(cycle => <option key={cycle} value={cycle}>{cycle}</option>)}
                  </select>
                </label>
                <label>
                  <span className="label">Min Rating</span>
                  <input className="input" type="number" min="0" max="5" step="0.1" value={reportFilters.ratingMin} onChange={e => setReportFilter('ratingMin', e.target.value)} placeholder="0" />
                </label>
                <label>
                  <span className="label">Max Rating</span>
                  <input className="input" type="number" min="0" max="5" step="0.1" value={reportFilters.ratingMax} onChange={e => setReportFilter('ratingMax', e.target.value)} placeholder="5" />
                </label>
              </>
            )}
          </div>
        </div>

        {reportType === 'attendance' && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {Object.entries(attendanceShiftGroups).map(([shift, rows]) => {
                const lateMinutes = rows.reduce((sum, row) => sum + (Number(row.LateMinutes) || 0), 0)
                const completed = rows.filter(row => row.ShiftResult === 'Completed Shift').length
                const early = rows.filter(row => Number(row.EarlyLeaveMinutes) > 0).length
                return (
                  <div key={shift} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <p className="text-sm font-bold text-gray-900">{shift}</p>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-center text-xs">
                      <div><p className="font-bold text-gray-900">{rows.length}</p><p className="text-gray-400">Rows</p></div>
                      <div><p className="font-bold text-emerald-700">{completed}</p><p className="text-gray-400">Done</p></div>
                      <div><p className="font-bold text-amber-700">{lateMinutes}</p><p className="text-gray-400">Late min</p></div>
                      <div><p className="font-bold text-gray-700">{early}</p><p className="text-gray-400">Early</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => exportRowsAsCsv(`Fuchsius HRMS-${shift}-attendance.csv`, rows)}
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => exportAttendanceByShiftPdf({
                          rows,
                          subtitle: `${shift}. ${attendanceSubtitle}`,
                          filename: `Fuchsius HRMS-${shift}-attendance.pdf`,
                        })}
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {currentRows.length === 0 && <p className="text-xs text-gray-400 mt-3">No attendance records found for this date and shift filter.</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Headcount by dept */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Headcount by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={filteredDeptHeadcount} layout="vertical" barSize={16}>
              <XAxis type="number" tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false} width={80} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a1a1a" radius={[0,4,4,0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Employee status */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Employee Status Distribution</h3>
          <div className="flex items-center justify-center">
            <PieChart width={200} height={200}>
              <Pie data={filteredStatusData} cx={100} cy={100} innerRadius={55} outerRadius={85} dataKey="value">
              {filteredStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
            <div className="space-y-2 ml-4">
              {filteredStatusData.map((s,i) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{background:COLORS[i % COLORS.length]}} />
                  <span className="text-xs text-gray-600">{s.name}: <strong>{s.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payroll trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll Cost Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredPayrollTrend}>
              <XAxis dataKey="month" tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>formatCurrencyShort(v)} />
              <Tooltip formatter={v=>formatCurrency(v)} />
              <Line type="monotone" dataKey="gross" stroke="#1a1a1a" strokeWidth={2} name="Gross" dot={false} />
              <Line type="monotone" dataKey="net"   stroke="#737373" strokeWidth={2} name="Net"   dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Attendance Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={filteredAttendanceTrend}>
              <XAxis dataKey="month" tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{fontSize:11}} />
              <Line type="monotone" dataKey="present" stroke="#1a1a1a" strokeWidth={2} name="Present" dot={false} />
              <Line type="monotone" dataKey="absent"  stroke="#ef4444" strokeWidth={2} name="Absent"  dot={false} />
              <Line type="monotone" dataKey="late"    stroke="#f59e0b" strokeWidth={2} name="Late"    dot={false} />
              <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Completed Shifts" dot={false} />
              <Line type="monotone" dataKey="earlyLeave" stroke="#9ca3af" strokeWidth={2} name="Early Leaves" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <p className="text-gray-400">Late Minutes</p>
              <p className="font-bold text-gray-800">{filteredAttendanceTrend.reduce((sum, row) => sum + (row.lateMinutes || 0), 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <p className="text-gray-400">Completed Shifts</p>
              <p className="font-bold text-emerald-700">{filteredAttendanceTrend.reduce((sum, row) => sum + (row.completed || 0), 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <p className="text-gray-400">Early Leaves</p>
              <p className="font-bold text-gray-700">{filteredAttendanceTrend.reduce((sum, row) => sum + (row.earlyLeave || 0), 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Report shortcuts */}
      <div className="card p-5 mt-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Generate Reports</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['Employee Headcount', 'all'],
            ['Payroll Summary', 'payroll'],
            ['Attendance Report', 'attendance'],
            ['Leave Summary', 'leave'],
            ['Performance Summary', 'performance'],
          ].map(([label, value]) => (
            <button
              key={label}
              onClick={() => setReportType(value)}
              className={`flex items-center gap-2 p-3 border rounded-lg text-xs font-medium transition text-left ${
                reportType === value ? 'border-gray-900 bg-gray-50 text-gray-950' : 'border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />{label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
