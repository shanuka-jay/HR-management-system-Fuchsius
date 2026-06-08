import React from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader'
import { Star } from 'lucide-react'
import { useHR } from '../../../context/HRContext'
import useManagerTeam from '../../../hooks/useManagerTeam'

export default function ManagerPerformance() {
  const navigate = useNavigate()
  const { performanceReviews } = useHR()
  const { teamIds } = useManagerTeam()
  const teamReviews = performanceReviews.filter(r => teamIds.includes(r.empId))

  return (
    <div>
      <PageHeader title="Team Performance" subtitle="Review team goals, KPIs, and conduct appraisals" />

      <div className="card overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Team Performance Reviews</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr>
              {['Employee','Period','Goals Progress','Current Rating','Status','Action'].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamReviews.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium text-gray-800">{r.employee}</td>
                <td className="table-cell text-xs text-gray-500">{r.period}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-gray-800 h-1.5 rounded-full" style={{width:`${r.goals ? (r.completed/r.goals)*100 : 0}%`}} />
                    </div>
                    <span className="text-xs text-gray-500">{r.completed}/{r.goals}</span>
                  </div>
                </td>
                <td className="table-cell">
                  {r.rating ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-semibold">{r.rating}</span>
                    </div>
                  ) : <span className="text-xs text-gray-400">Not rated</span>}
                </td>
                <td className="table-cell">
                  <span className={r.status === 'Completed' ? 'badge-green' : 'badge-yellow'}>{r.status}</span>
                </td>
                <td className="table-cell">
                  {r.status === 'In Progress' ? (
                    <button onClick={() => navigate(`/manager/team/${r.empId}/review`)} className="btn-primary text-xs py-1 px-3">
                      <Star className="w-3 h-3" /> Rate
                    </button>
                  ) : (
                    <button className="btn-ghost text-xs" onClick={() => navigate(`/manager/team/${r.empId}/review`)}>View</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
