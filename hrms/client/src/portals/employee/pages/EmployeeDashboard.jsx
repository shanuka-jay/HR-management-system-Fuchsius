import React, { useState, useEffect } from 'react'
import { CalendarCheck, Clock, LogIn, LogOut, Loader2 } from 'lucide-react'
import { useHR } from '../../../context/HRContext'
import { attendanceApi, payrollApi, performanceApi, holidaysApi } from '../../../api/services'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'
import { leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'
import { formatCurrency } from '../../../utils/currency'

export default function EmployeeDashboard() {
  const { employee, loading, isLinked } = useCurrentEmployee()
  const { leaveRequests, checkIn, checkOut } = useHR()

  const [checkLoading,setCheckLoading]= useState(false)
  const [latestPay,   setLatestPay]   = useState(null)
  const [myReview,    setMyReview]    = useState(null)
  const [myGoals,     setMyGoals]     = useState([])
  const [holidays,    setHolidays]    = useState([])
  const [attendance,  setAttendance]  = useState([])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const todayLabel = now.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })

  const loadDashboardData = () => {
    if (!employee) return
    Promise.all([
      payrollApi.employee(employee.id).catch(() => ({ data: [] })),
      performanceApi.reviews({ employeeId: employee.id }).catch(() => ({ data: [] })),
      performanceApi.goals(employee.id).catch(() => ({ data: [] })),
      holidaysApi.list().catch(() => ({ data: [] })),
      attendanceApi.employee(employee.id).catch(() => ({ data: [] })),
    ]).then(([pay, rev, goals, hols, att]) => {
      setLatestPay(pay.data?.[0] || null)
      setMyReview(rev.data?.find(r => r.rating) || rev.data?.[0] || null)
      setMyGoals(goals.data || [])
      setHolidays(hols.data || [])
      setAttendance(att.data || [])
    })
  }

  useEffect(() => {
    loadDashboardData()
  }, [employee?.id])

  const myLeaves = leaveRequests.filter(l => l.empId === employee?.id)
  const completedGoals = myGoals.filter(g => g.status === 'Completed').length
  const today = new Date().toISOString().slice(0, 10)
  const todayRecord = attendance.find(item => item.date === today)
  const checkedIn = Boolean(todayRecord?.checkIn && todayRecord.checkIn !== '-' && (!todayRecord.checkOut || todayRecord.checkOut === '-'))
  const checkInTime = checkedIn ? todayRecord.checkIn : ''

  const toggleCheck = async () => {
    setCheckLoading(true)
    try {
      if (!checkedIn) {
        await checkIn()
      } else {
        await checkOut()
      }
      const refreshed = await attendanceApi.employee(employee.id)
      setAttendance(refreshed.data || [])
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record attendance')
    } finally {
      setCheckLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
      <Loader2 className="w-6 h-6 animate-spin" /> Loading…
    </div>
  )

  if (!isLinked) return (
    <div className="card p-8 text-center text-sm text-gray-500">
      No linked employee record found for this account. Please ask HR to link your employee profile.
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Hero check-in banner */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-6 shadow-xl border border-slate-600">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm ${checkedIn ? 'bg-white/10 text-white border border-white/10' : 'bg-white/5 text-gray-200 border border-white/10'}`}>
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-300">Employee Workspace</p>
              <h2 className="text-2xl font-black text-white mt-1">{greeting}, {employee.name.split(' ')[0]}</h2>
              <p className="text-sm text-gray-200 mt-1">{todayLabel} • {employee.dept} Team</p>
              {checkedIn && <p className="text-emerald-300 text-sm font-semibold mt-2">Checked in at {checkInTime}</p>}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${checkedIn ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-white/10 text-gray-300 border border-white/10'}`}>
              {checkedIn ? 'Clocked In' : 'Clocked Out'}
            </span>
            <button
              onClick={toggleCheck}
              disabled={checkLoading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-md disabled:opacity-60 ${checkedIn ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              {checkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> :
               checkedIn ? <><LogOut className="w-4 h-4" /> Check Out</> :
                           <><LogIn  className="w-4 h-4" /> Check In</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          {[
            ['Employee ID', employee.id],
            ['Department',  employee.dept],
            ['Position',    employee.role],
            ['Status',      employee.status],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-xs uppercase tracking-wider text-gray-400">{k}</p>
              <p className={`font-semibold mt-1 ${v === 'Active' ? 'text-emerald-300' : 'text-white'}`}>{v || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{employee.leaveBalance ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Leave Balance</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{latestPay ? formatCurrency(latestPay.net, latestPay.currency) : '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Last Net Pay</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{myReview?.rating || 'Pending'}</p>
          <p className="text-xs text-gray-500 mt-0.5">Performance Score</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{completedGoals}/{myGoals.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Goals Complete</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Attendance */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Attendance</h3>
          <div className="space-y-1.5">
            {attendance.slice(0,5).map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="text-xs text-gray-500 font-mono w-24">{a.date}</div>
                <div className="text-xs text-gray-600 flex-1 text-center">
                  {a.checkIn !== '-' ? `${a.checkIn} → ${a.checkOut}` : '—'}
                </div>
                <span className={a.status === 'Present' ? 'badge-green' : a.status === 'Late' ? 'badge-yellow' : a.status === 'On Leave' ? 'badge-blue' : 'badge-red'}>
                  {a.status}
                </span>
              </div>
            ))}
            {attendance.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No attendance records yet.</p>}
          </div>
        </div>

        {/* My Leaves */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">My Leave Requests</h3>
          {myLeaves.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No leave requests</p>
          ) : (
            <div className="space-y-2">
              {myLeaves.slice(0,5).map(l => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{l.type}</p>
                    <p className="text-xs text-gray-400">{l.start} · {l.days}d</p>
                  </div>
                  <span className={leaveStatusClass(l.status)}>{leaveStatusLabel(l.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Holidays */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Public Holidays</h3>
        <div className="flex flex-wrap gap-3">
          {holidays.slice(0,5).map(h => (
            <div key={h.date} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <CalendarCheck className="w-3.5 h-3.5 text-gray-500" />
              <div>
                <p className="text-xs font-medium text-gray-700">{h.name}</p>
                <p className="text-xs text-gray-400">{h.date}</p>
              </div>
            </div>
          ))}
          {holidays.length === 0 && <p className="text-xs text-gray-400">No upcoming holidays.</p>}
        </div>
      </div>
    </div>
  )
}
