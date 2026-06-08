import React, { useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { CheckCircle, MessageSquare, XCircle } from 'lucide-react'
import useManagerTeam from '../../../hooks/useManagerTeam'
import { isLeaveActionableByManager, leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'

export default function ManagerLeaveApproval() {
  const { leaveRequests, approveLeave, rejectLeave } = useHR()
  const { teamIds } = useManagerTeam()
  const [filter, setFilter] = useState('Pending')
  const [noteModal, setNoteModal] = useState(null)
  const [decisionNote, setDecisionNote] = useState('')

  const leaves = leaveRequests.filter((leave) => teamIds.includes(leave.empId))
  const filtered = leaves.filter((leave) => !filter || leave.status === filter)

  return (
    <div>
      <PageHeader
        meta="Manager workflow"
        title="Leave Approval"
        subtitle="Review team leave requests submitted from the employee self-service portal."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {['Pending', 'Pending HR', 'Approved', 'Rejected', ''].map((status) => (
          <button
            key={status || 'All'}
            onClick={() => setFilter(status)}
            className={`rounded-md px-4 py-2 text-xs font-semibold transition ${
              filter === status
                ? 'bg-gray-950 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {status || 'All'}{status && ` (${leaves.filter((leave) => leave.status === status).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-400">No leave requests in this view.</div>
        ) : (
          filtered.map((leave) => (
            <div key={leave.id} className={`card p-4 ${leave.status === 'Pending' ? 'border-gray-400' : ''}`}>
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-950 text-xs font-bold text-white">
                      {leave.employee.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-gray-900">{leave.employee}</span>
                    <span className="badge-gray">{leave.type}</span>
                    <span className={leaveStatusClass(leave.status)}>{leaveStatusLabel(leave.status)}</span>
                  </div>
                  <div className="grid gap-2 pl-10 text-xs text-gray-500 sm:grid-cols-2 xl:grid-cols-4">
                    <span>{leave.start} to {leave.end}</span>
                    <span>{leave.days} day{leave.days > 1 ? 's' : ''}</span>
                    <span>{leave.reason}</span>
                    <span>Applied {leave.appliedOn}</span>
                    {leave.decisionNote && <span>Note: {leave.decisionNote}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                  {isLeaveActionableByManager(leave.status) ? (
                    <>
                      <button onClick={() => setNoteModal(leave.id)} className="btn-ghost text-xs" title="Add note">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => approveLeave(leave.id)} className="btn-secondary text-xs">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Approve for HR
                      </button>
                      <button onClick={() => rejectLeave(leave.id)} className="btn-danger text-xs">
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">
                      {leave.status === 'Pending HR' ? 'Waiting for HR final approval' : 'Decision synced'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={!!noteModal} onClose={() => { setNoteModal(null); setDecisionNote('') }} title="Add Decision Note" size="sm">
        <div className="space-y-3">
          <div>
            <label className="label">Note / Reason</label>
            <textarea className="input" rows={3} placeholder="Add a comment for the employee." value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={() => { approveLeave(noteModal, decisionNote); setDecisionNote(''); setNoteModal(null) }}>
              Approve for HR
            </button>
            <button className="btn-danger flex-1" onClick={() => { rejectLeave(noteModal, decisionNote); setDecisionNote(''); setNoteModal(null) }}>
              Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
