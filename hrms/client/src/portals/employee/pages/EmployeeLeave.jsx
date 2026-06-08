import React, { useMemo, useState, useEffect } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { CalendarCheck, Clock, Plus, Send, Loader2 } from 'lucide-react'
import { holidaysApi } from '../../../api/services'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'
import { leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'

const leaveTypes = [
  { type: 'Vacation', total: 15 },
  { type: 'Sick Leave', total: 10 },
  { type: 'Personal', total: 5 },
  { type: 'Maternity', total: 0 },
]

export default function EmployeeLeave() {
  const { leaveRequests, applyLeave } = useHR()
  const { employee, loading, isLinked } = useCurrentEmployee()
  const myLeaves = leaveRequests.filter((leave) => leave.empId === employee?.id)
  const [showModal,  setShowModal]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [holidays,   setHolidays]   = useState([])
  const [form, setForm] = useState({ type:'Vacation', start:'', end:'', reason:'' })

  useEffect(() => {
    holidaysApi.list().then(r => setHolidays(r.data)).catch(() => {})
  }, [])

  const usedByType = useMemo(() => {
    return myLeaves
      .filter((leave) => leave.status === 'Approved')
      .reduce((acc, leave) => ({ ...acc, [leave.type]: (acc[leave.type] || 0) + leave.days }), {})
  }, [myLeaves])

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const totalRemaining = employee?.leaveBalance ?? leaveTypes.reduce(
    (sum, item) => sum + Math.max(0, item.total - (usedByType[item.type] || 0)),
    0
  )
  const pending = myLeaves.filter((leave) => leave.status === 'Pending' || leave.status === 'Pending HR').length

  const submitLeave = async () => {
    if (!form.start || !form.end || !form.reason.trim()) {
      alert('Please add dates and a reason before submitting.')
      return
    }
    setSubmitting(true)
    try {
      await applyLeave({
        ...form,
        employeeId: employee?.id,
        employee: employee?.name,
        empId: employee?.id,
      })
      setForm({ type: 'Vacation', start: '', end: '', reason: '' })
      setShowModal(false)
    } catch (err) {
      alert('Failed to apply leave: ' + (err.response?.data?.error || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /> Loading...</div>
  if (!isLinked) return <div className="card p-8 text-center text-sm text-gray-500">No linked employee record found for this account. Please ask HR to link your employee profile.</div>

  return (
    <div>
      <PageHeader
        meta="Self service"
        title="My Leave"
        subtitle="Apply once and track the same request across employee, manager, and HR workspaces."
        actions={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Apply Leave
          </button>
        }
      />

      <div className="card p-6 mb-6 bg-gray-950 text-white">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Leave command center</p>
            <h3 className="mt-2 text-2xl font-black">You have {totalRemaining} days available</h3>
            <p className="mt-2 text-sm text-gray-300">
              {pending} request{pending === 1 ? '' : 's'} waiting for approval.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {leaveTypes.map((item) => {
              const used = usedByType[item.type] || 0
              const balance = Math.max(0, item.total - used)
              return (
                <div key={item.type} className="rounded-lg border border-white/10 bg-white/10 p-4">
                  <p className="text-xs text-gray-400">{item.type}</p>
                  <p className="mt-2 text-2xl font-black">{balance}</p>
                  <p className="text-xs text-gray-400">of {item.total}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h3 className="text-sm font-bold text-gray-900">Leave History</h3>
            <Clock className="h-4 w-4 text-gray-500" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['Type', 'From', 'To', 'Days', 'Reason', 'Decision Note', 'Status'].map((heading) => (
                    <th key={heading} className="table-head">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-gray-50">
                    <td className="table-cell"><span className="badge-gray">{leave.type}</span></td>
                    <td className="table-cell text-xs">{leave.start}</td>
                    <td className="table-cell text-xs">{leave.end}</td>
                    <td className="table-cell text-xs font-semibold">{leave.days}</td>
                    <td className="table-cell text-xs text-gray-500">{leave.reason}</td>
                    <td className="table-cell text-xs text-gray-500">{leave.decisionNote || '-'}</td>
                    <td className="table-cell"><span className={leaveStatusClass(leave.status)}>{leaveStatusLabel(leave.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
            <CalendarCheck className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-bold text-gray-900">Upcoming Holidays</h3>
          </div>
          <div className="space-y-2 p-4">
            {holidays.slice(0, 5).map((holiday) => (
              <div key={holiday.date} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                <span className="text-sm font-medium text-gray-800">{holiday.name}</span>
                <span className="text-xs font-mono text-gray-500">{holiday.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Apply for Leave">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="leave-type">Leave Type</label>
            <select id="leave-type" className="select" value={form.type} onChange={(event) => set('type', event.target.value)}>
              {leaveTypes.map((item) => (
                <option key={item.type}>{item.type}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="leave-start">Start Date</label>
              <input id="leave-start" className="input" type="date" value={form.start} onChange={(event) => set('start', event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="leave-end">End Date</label>
              <input id="leave-end" className="input" type="date" value={form.end} onChange={(event) => set('end', event.target.value)} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="leave-reason">Reason</label>
            <textarea
              id="leave-reason"
              className="input"
              rows={3}
              value={form.reason}
              onChange={(event) => set('reason', event.target.value)}
              placeholder="Add a short reason for your manager."
            />
          </div>
          <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={submitLeave} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit Request
          </button>
        </div>
      </Modal>
    </div>
  )
}
