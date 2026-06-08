import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import StatCard from '../../../components/shared/StatCard'
import SelfAttendanceCard from '../../../components/shared/SelfAttendanceCard'
import { Users, Building2, Activity, DollarSign, AlertCircle, Loader2 } from 'lucide-react'
import { employeesApi, departmentsApi, auditLogsApi, reportsApi } from '../../../api/services'
import { formatCurrency, formatCurrencyShort } from '../../../utils/currency'

export default function AdminDashboard() {
  const [employees,   setEmployees]   = useState([])
  const [departments, setDepartments] = useState([])
  const [auditLogs,   setAuditLogs]   = useState([])
  const [payTrend,    setPayTrend]    = useState([])
  const [attendanceTrend, setAttendanceTrend] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      employeesApi.list(),
      departmentsApi.list(),
      auditLogsApi.list({ limit: 5 }),
      reportsApi.summary(),
      reportsApi.analytics(),
    ]).then(([e, d, a, s, analytics]) => {
      setEmployees(e.data)
      setDepartments(d.data)
      setAuditLogs(a.data.logs || [])
      setSummary(s.data)
      setPayTrend(analytics.data.payroll || [])
      setAttendanceTrend(analytics.data.attendance || [])
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  const activeUsers  = summary?.employees?.active ?? employees.filter(e => e.status === 'Active').length
  const totalPayroll = summary?.payroll?.gross ?? (payTrend.length ? payTrend[payTrend.length - 1]?.gross : 0)

  const levelBadge = { LOGIN:'badge-gray', CREATE_EMPLOYEE:'badge-green', RUN_PAYROLL:'badge-green', UPDATE_USER:'badge-yellow', DEACTIVATE_USER:'badge-red' }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin" /> Loading dashboard…
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={summary?.employees?.total ?? employees.length} icon={Users} change="Live from DB" />
        <StatCard label="Departments"     value={summary?.departments ?? departments.length} icon={Building2} />
        <StatCard label="Active Users"    value={activeUsers} icon={Activity} change={`${Math.round(activeUsers / Math.max(employees.length, 1) * 100)}% rate`} />
        <StatCard label="Payroll Cost"    value={formatCurrencyShort(totalPayroll || 0)} icon={DollarSign} sub="Latest month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SelfAttendanceCard />
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">System Staff Attendance</h3>
          <p className="text-sm text-gray-500">
            Admin attendance uses the same check-in/check-out endpoint and appears in global attendance reporting with the rest of the organization.
          </p>
          <Link to="/admin/attendance" className="btn-secondary mt-4 inline-flex text-xs">Open Attendance Sheet</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payroll trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Payroll Cost</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={payTrend} barSize={24}>
              <XAxis dataKey="month" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>formatCurrencyShort(v)} />
              <Tooltip formatter={v=>formatCurrency(v)} />
              <Bar dataKey="gross" fill="#1a1a1a" radius={[4,4,0,0]} name="Gross" />
              <Bar dataKey="net"   fill="#d1d1d1" radius={[4,4,0,0]} name="Net"   />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance trend */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Attendance Overview</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceTrend}>
              <XAxis dataKey="month" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="present" stroke="#1a1a1a" strokeWidth={2} dot={false} name="Present" />
              <Line type="monotone" dataKey="absent"  stroke="#ef4444" strokeWidth={2} dot={false} name="Absent"  />
              <Line type="monotone" dataKey="late"    stroke="#f59e0b" strokeWidth={2} dot={false} name="Late"    />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Departments</h3>
          <div className="space-y-2">
            {departments.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.name}</p>
                  <p className="text-xs text-gray-400">Head: {d.head || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{d.employees} emp</p>
                  <p className="text-xs text-gray-400">{formatCurrencyShort(d.budget)} budget</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Events */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Audit Events</h3>
          <div className="space-y-2">
            {auditLogs.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No audit events yet.</p>
            )}
            {auditLogs.slice(0, 5).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{e.action.replace(/_/g,' ')}</p>
                  <p className="text-xs text-gray-400">{e.user} · {new Date(e.time).toLocaleString()}</p>
                </div>
                <span className={levelBadge[e.action] || 'badge-gray'}>{e.module}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
