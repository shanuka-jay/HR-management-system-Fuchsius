import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader'
import { Mail, Phone, TrendingUp } from 'lucide-react'
import useManagerTeam from '../../../hooks/useManagerTeam'

export default function ManagerTeam() {
  const navigate = useNavigate()
  const { team: myTeam } = useManagerTeam()

  return (
    <div>
      <PageHeader title="Team Directory" subtitle={`Managing ${myTeam.length} direct reports`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {myTeam.map(emp => (
          <div key={emp.id} className="card p-5 hover:shadow-card-hover transition-shadow">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                {emp.avatar ? (
                  <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-gray-600">{emp.name.charAt(0)}</span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{emp.name}</h3>
                <p className="text-xs text-gray-500">{emp.role}</p>
                <span className={`mt-1 inline-block ${emp.status === 'Active' ? 'badge-green' : 'badge-yellow'}`}>{emp.status}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Mail className="w-3.5 h-3.5" /><span className="truncate">{emp.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Phone className="w-3.5 h-3.5" />{emp.phone}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Leave: {emp.leaveBalance}d left</span>
              <button
                className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium"
                onClick={() => navigate(`/manager/team/${emp.id}/review`)}
              >
                <TrendingUp className="w-3 h-3" /> Review
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
