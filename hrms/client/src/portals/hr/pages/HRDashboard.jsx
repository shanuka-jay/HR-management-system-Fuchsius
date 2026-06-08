import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../../../components/shared/StatCard'
import SelfAttendanceCard from '../../../components/shared/SelfAttendanceCard'
import { useHR } from '../../../context/HRContext'
import { payrollApi } from '../../../api/services'
import { Users, UserCheck, Briefcase, DollarSign, Clock, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { isLeaveActionableByHR, leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'
import { formatCurrency, formatCurrencyShort } from '../../../utils/currency'

export default function HRDashboard() {
  const { employees, leaveRequests, jobOpenings, approveLeave, rejectLeave } = useHR()
  const [payrollMonthly, setPayrollMonthly] = useState([])

  useEffect(() => {
    payrollApi.monthlyTrend().then(r => setPayrollMonthly(r.data || [])).catch(() => {})
  }, [])

  const activeEmp     = employees.filter(e => e.status === 'Active').length
  const pendingLeaves = leaveRequests.filter(l => isLeaveActionableByHR(l.status, l)).length
  const openJobs      = jobOpenings.filter(j => j.status === 'Active').length
  const newHires      = employees.filter(e => e.joined >= '2026-01-01').length
  const pendingList   = leaveRequests.filter(l => isLeaveActionableByHR(l.status, l))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees"  value={employees.length} icon={Users}     change={`${activeEmp} active`} />
        <StatCard label="New Hires (YTD)"  value={newHires}         icon={UserCheck} change="This year" />
        <StatCard label="HR Leave Review" value={pendingLeaves}    icon={Clock}     changeType="down" change="Final decision" />
        <StatCard label="Open Vacancies"   value={openJobs}         icon={Briefcase} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SelfAttendanceCard />
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Attendance Sheet Connection</h3>
          <p className="text-sm text-gray-500">
            HR check-in and check-out are saved to the same attendance table as employee records. Today's attendance page and reports include this record automatically.
          </p>
          <Link to="/hr/attendance" className="btn-secondary mt-4 inline-flex text-xs">Open Attendance Sheet</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payroll chart */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Payroll Summary (2026)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={payrollMonthly} barSize={20}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrencyShort(v)} />
              <Tooltip formatter={v => formatCurrency(v)} />
              <Bar dataKey="gross" fill="#404040" radius={[4,4,0,0]} name="Gross" />
              <Bar dataKey="net"   fill="#d1d1d1" radius={[4,4,0,0]} name="Net Payout" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label: 'Add New Employee',      to: '/hr/employees/add', icon: UserCheck },
              { label: 'Post Job Opening',       to: '/hr/recruitment',   icon: Briefcase },
              { label: 'Review Leave Requests',  to: '/hr/leave',         icon: Clock     },
              { label: 'Run Payroll',            to: '/hr/payroll',       icon: DollarSign },
              { label: 'Generate Report',        to: '/hr/reports',       icon: TrendingUp },
            ].map(({ label, to, icon: Icon }) => (
              <Link key={to} to={to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition text-sm text-gray-700 font-medium">
                <Icon className="w-4 h-4 text-gray-500" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Pending leave requests — functional approve/reject */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Leaves Ready for HR
            {pendingLeaves > 0 && (
              <span className="ml-2 bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingLeaves}
              </span>
            )}
          </h3>
          <Link to="/hr/leave" className="text-xs text-gray-500 hover:text-gray-900">View all →</Link>
        </div>
        {pendingList.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No leave requests ready for HR final approval.</p>
        ) : (
          <div className="space-y-2">
            {pendingList.map(l => (
              <div key={l.id} className="flex items-center justify-between py-2.5 px-3 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{l.employee}</p>
                  <span className={`${leaveStatusClass(l.status)} mt-1 inline-flex`}>{leaveStatusLabel(l.status)}</span>
                  <p className="text-xs text-gray-500">{l.type} · {l.start} → {l.end} ({l.days}d)</p>
                  {l.reason && <p className="text-xs text-gray-400 mt-0.5 italic">"{l.reason}"</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    className="btn-primary text-xs py-1 px-3"
                    onClick={() => approveLeave(l.id)}
                  >Final Approve</button>
                  <button
                    className="btn-secondary text-xs py-1 px-3"
                    onClick={() => rejectLeave(l.id)}
                  >Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
