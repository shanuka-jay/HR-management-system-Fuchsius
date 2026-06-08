import React from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Clock, TrendingUp, Users } from 'lucide-react'
import StatCard from '../../../components/shared/StatCard'
import SelfAttendanceCard from '../../../components/shared/SelfAttendanceCard'
import { useHR } from '../../../context/HRContext'
import useManagerTeam from '../../../hooks/useManagerTeam'

export default function ManagerDashboard() {
  const { leaveRequests, attendanceToday, approveLeave, rejectLeave } = useHR()
  const { manager, team: myTeam, teamIds } = useManagerTeam()
  const pendingLeaves = leaveRequests.filter(l => teamIds.includes(l.empId) && l.status === 'Pending')
  const teamAttendance = attendanceToday.filter(a => teamIds.includes(a.id))
  const presentCount = teamAttendance.filter(a => a.status === 'Present').length
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-6">
      <div className="card p-5 bg-gray-900 text-white">
        <h2 className="text-lg font-bold mb-1">{greeting}, {manager?.name?.split(' ')[0] || 'Manager'}</h2>
        <p className="text-gray-400 text-sm">You have {pendingLeaves.length} pending leave requests to review.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Team Members" value={myTeam.length} icon={Users} />
        <StatCard label="Present Today" value={presentCount} icon={Clock} change={`of ${myTeam.length}`} />
        <StatCard label="Pending Leaves" value={pendingLeaves.length} icon={CalendarCheck} changeType="down" />
        <StatCard label="Reviews Due" value={2} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SelfAttendanceCard />
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Attendance Is Included</h3>
          <p className="text-sm text-gray-500">
            Manager check-in and check-out are saved to the same attendance sheet as your team, while team views still show only your direct reports.
          </p>
          <Link to="/manager/attendance" className="btn-secondary mt-4 inline-flex text-xs">Open Team Attendance</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">My Team</h3>
          <div className="space-y-2">
            {myTeam.map(emp => {
              const att = attendanceToday.find(a => a.id === emp.id)
              return (
                <div key={emp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-600">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.role}</p>
                    </div>
                  </div>
                  <span className={
                    !att ? 'badge-gray' :
                    att.status === 'Present' ? 'badge-green' :
                    att.status === 'Late' ? 'badge-yellow' :
                    att.status === 'On Leave' ? 'badge-blue' : 'badge-red'
                  }>{att?.status || 'Unknown'}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Leave Requests</h3>
            <Link to="/manager/leave" className="text-xs text-gray-500 hover:text-gray-900">View all</Link>
          </div>
          {pendingLeaves.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No pending requests</p>
          ) : (
            <div className="space-y-2">
              {pendingLeaves.map(l => (
                <div key={l.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{l.employee}</p>
                      <p className="text-xs text-gray-500">{l.type} - {l.days} day{l.days > 1 ? 's' : ''} - {l.start}</p>
                    </div>
                    <span className="badge-yellow text-xs">Pending</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1 text-xs py-1" onClick={() => approveLeave(l.id)}>Approve for HR</button>
                    <button className="btn-secondary text-xs py-1 px-3" onClick={() => rejectLeave(l.id)}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
