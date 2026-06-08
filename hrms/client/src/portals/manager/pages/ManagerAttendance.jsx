import React from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { AlertTriangle } from 'lucide-react'
import { useHR } from '../../../context/HRContext'
import useManagerTeam from '../../../hooks/useManagerTeam'

export default function ManagerAttendance() {
  const { attendanceToday } = useHR()
  const { teamIds } = useManagerTeam()
  const myAttendance = attendanceToday.filter(a => teamIds.includes(a.id))
  const issues = myAttendance.filter(a => a.status === 'Late' || a.status === 'Absent' || a.earlyLeaveMinutes > 0)

  return (
    <div>
      <PageHeader title="Team Attendance" subtitle="Today's team attendance with shift, late, and completion analysis." />

      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Attendance Issues Today</span>
          </div>
          {issues.map(a => (
            <p key={a.id} className="text-xs text-amber-700 ml-6">
              {a.name} - <strong>{a.status}</strong>
              {a.status === 'Late' && ` (${a.shift || 'Shift'}: ${a.lateMinutes || 0} min late)`}
              {a.earlyLeaveMinutes > 0 && ` (${a.shiftResult})`}
            </p>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead>
              <tr>
                {['Employee','Shift','Check In','Check Out','Hours Worked','Late','Result','Status'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myAttendance.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium text-gray-800">{a.name}</td>
                  <td className="table-cell">
                    <p className="text-xs font-semibold text-gray-700">{a.shift || '-'}</p>
                    <p className="text-[11px] text-gray-400">{a.shiftStart || '-'} to {a.shiftEnd || '-'}</p>
                  </td>
                  <td className="table-cell font-mono text-xs text-gray-600">{a.checkIn}</td>
                  <td className="table-cell font-mono text-xs text-gray-600">{a.checkOut}</td>
                  <td className="table-cell">{a.hours > 0 ? `${a.hours}h` : '-'}</td>
                  <td className="table-cell text-xs">{a.lateMinutes ? `${a.lateMinutes} min` : '-'}</td>
                  <td className="table-cell text-xs text-gray-600">{a.shiftResult || '-'}</td>
                  <td className="table-cell">
                    <span className={
                      a.status === 'Present'  ? 'badge-green'  :
                      a.status === 'Late'     ? 'badge-yellow' :
                      a.status === 'On Leave' ? 'badge-blue'   : 'badge-red'
                    }>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
