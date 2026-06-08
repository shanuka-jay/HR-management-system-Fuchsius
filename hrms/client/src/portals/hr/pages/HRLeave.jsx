import React, { useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { CheckCircle, XCircle, Clock, Info } from 'lucide-react'
import { isLeaveActionableByHR, leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'

export default function HRLeave() {
  const { leaveRequests, approveLeave, rejectLeave } = useHR()
  const [filter, setFilter]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [detailLeave, setDetailLeave] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')

  const decide = async (leave, status) => {
    if (status === 'Approved') await approveLeave(leave.id, decisionNote)
    else await rejectLeave(leave.id, decisionNote)
    setDecisionNote('')
    setDetailLeave(null)
  }

  const filtered = leaveRequests.filter(l => {
    const matchStatus = !filter     || l.status === filter
    const matchType   = !typeFilter || l.type   === typeFilter
    return matchStatus && matchType
  })

  const pending  = leaveRequests.filter(l => isLeaveActionableByHR(l.status, l)).length
  const pendingHr = leaveRequests.filter(l => l.status === 'Pending HR').length
  const approved = leaveRequests.filter(l => l.status === 'Approved').length
  const rejected = leaveRequests.filter(l => l.status === 'Rejected').length

  return (
    <div>
      <PageHeader
        title="Leave Management"
        subtitle="Review and manage all employee leave requests"
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-amber-500 bg-amber-50 rounded-lg p-1.5" />
          <div><p className="text-xl font-bold text-gray-900">{pending}</p><p className="text-xs text-gray-500">{pendingHr} ready for HR</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-emerald-500 bg-emerald-50 rounded-lg p-1.5" />
          <div><p className="text-xl font-bold text-gray-900">{approved}</p><p className="text-xs text-gray-500">Approved</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <XCircle className="w-8 h-8 text-red-500 bg-red-50 rounded-lg p-1.5" />
          <div><p className="text-xl font-bold text-gray-900">{rejected}</p><p className="text-xs text-gray-500">Rejected</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="select w-36 text-sm" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Pending</option><option>Pending HR</option><option>Approved</option><option>Rejected</option>
        </select>
        <select className="select w-40 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option>Vacation</option><option>Sick Leave</option><option>Personal</option><option>Maternity</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr>
              {['Employee', 'Type', 'From', 'To', 'Days', 'Status', 'Applied On', 'Actions'].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium text-gray-800">{l.employee}</td>
                <td className="table-cell text-xs"><span className="badge-gray">{l.type}</span></td>
                <td className="table-cell text-xs text-gray-500">{l.start}</td>
                <td className="table-cell text-xs text-gray-500">{l.end}</td>
                <td className="table-cell text-center font-semibold">{l.days}</td>
                <td className="table-cell">
                  <span className={leaveStatusClass(l.status)}>
                    {leaveStatusLabel(l.status)}
                  </span>
                </td>
                <td className="table-cell text-xs text-gray-400">{l.appliedOn}</td>
                <td className="table-cell">
                  {isLeaveActionableByHR(l.status, l) ? (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => approveLeave(l.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition font-medium"
                      >
                        <CheckCircle className="w-3 h-3" />Final Approve
                      </button>
                      <button
                        onClick={() => rejectLeave(l.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
                      >
                        <XCircle className="w-3 h-3" />Reject
                      </button>
                      <button
                        onClick={() => setDetailLeave(l)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium"
                      >
                        <Info className="w-3 h-3" />Details
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => setDetailLeave(l)}
                    >
                      <Info className="w-3 h-3" /> Details
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-400">No leave requests found.</div>
        )}
      </div>

      {/* Details Modal */}
      <Modal open={!!detailLeave} onClose={() => setDetailLeave(null)} title="Leave Request Details" size="sm">
        {detailLeave && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-gray-600">{detailLeave.employee.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{detailLeave.employee}</p>
                <span className={leaveStatusClass(detailLeave.status)}>
                  {leaveStatusLabel(detailLeave.status)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {[
                ['Leave Type',  detailLeave.type],
                ['From',        detailLeave.start],
                ['To',          detailLeave.end],
                ['Total Days',  `${detailLeave.days} day(s)`],
                ['Applied On',  detailLeave.appliedOn],
                ['Reason',      detailLeave.reason || '—'],
                ['Decision Note', detailLeave.decisionNote || '—'],
                ['Decided By', detailLeave.decidedBy || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
            {isLeaveActionableByHR(detailLeave.status, detailLeave) && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <textarea className="input" rows={2} placeholder="Decision note for employee" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
                <div className="flex gap-3">
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
                    onClick={() => decide(detailLeave, 'Approved')}
                  >
                    <CheckCircle className="w-4 h-4" /> Final Approve
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition"
                    onClick={() => decide(detailLeave, 'Rejected')}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            )}
            {!isLeaveActionableByHR(detailLeave.status, detailLeave) && (
              <button className="btn-secondary w-full" onClick={() => setDetailLeave(null)}>Close</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
