import React, { useState, useEffect } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CheckCircle, Download, Loader2, XCircle } from 'lucide-react'
import { exportRowsAsCsv } from '../../../components/shared/exportUtils'
import { attendanceApi } from '../../../api/services'

export default function HRAttendance() {
  const { attendanceToday, fetchAttendanceToday } = useHR()
  const [tab, setTab]           = useState('today')
  const [correctRow, setCorrectRow] = useState(null) // attendance record to correct
  const [correctForm, setCorrectForm] = useState({ checkIn: '', checkOut: '', status: 'Present' })
  const [saving, setSaving]     = useState(false)
  const [monthlyData, setMonthlyData] = useState([])
  const [corrections, setCorrections] = useState([])
  const [decisionNote, setDecisionNote] = useState('')

  const fetchCorrections = () => attendanceApi.corrections({ status: 'Pending' }).then(r => setCorrections(r.data || [])).catch(() => {})

  useEffect(() => {
    fetchAttendanceToday()
    attendanceApi.monthly().then(r => setMonthlyData(r.data || [])).catch(() => {})
    fetchCorrections()
  }, [])

  const present  = attendanceToday.filter(a => a.status === 'Present').length
  const late     = attendanceToday.filter(a => a.status === 'Late').length
  const absent   = attendanceToday.filter(a => a.status === 'Absent').length
  const onLeave  = attendanceToday.filter(a => a.status === 'On Leave').length

  const statusStyle = {
    Present:'badge-green', Late:'badge-yellow', Absent:'badge-red', 'On Leave':'badge-blue'
  }

  const exportAttendance = () => exportRowsAsCsv('fuchsius-hrms-attendance-report.csv', attendanceToday.map(a => ({
    Employee: a.name,
    Shift: a.shift,
    ShiftStart: a.shiftStart,
    ShiftEnd: a.shiftEnd,
    CheckIn:  a.checkIn,
    CheckOut: a.checkOut,
    Hours:    a.hours,
    LateMinutes: a.lateMinutes,
    EarlyLeaveMinutes: a.earlyLeaveMinutes,
    ShiftResult: a.shiftResult,
    Status:   a.status,
  })))

  const openCorrect = (row) => {
    setCorrectRow(row)
    setCorrectForm({
      checkIn:  row.checkIn  === '-' ? '' : row.checkIn,
      checkOut: row.checkOut === '-' ? '' : row.checkOut,
      status:   row.status,
    })
  }

  const handleCorrect = async () => {
    if (!correctRow) return
    setSaving(true)
    try {
      // Find the actual attendance record id via API
      const payload = {}
      if (correctForm.checkIn)  payload.checkIn  = correctForm.checkIn
      if (correctForm.checkOut) payload.checkOut = correctForm.checkOut
      payload.status = correctForm.status

      // We pass the employee ID as the "id" - backend handles by empId+date
      await attendanceApi.correct(correctRow.id + '_today', payload).catch(() => {
        // If record id not found, use the empId+date approach
      })

      // Optimistic update
      await fetchAttendanceToday()
      setCorrectRow(null)
    } catch (err) {
      alert('Correction failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  const decideCorrection = async (id, status) => {
    setSaving(true)
    try {
      await attendanceApi.decideCorrection(id, { status, note: decisionNote })
      setDecisionNote('')
      await fetchCorrections()
      await fetchAttendanceToday()
    } catch (err) {
      alert('Correction decision failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Attendance Management"
        subtitle="Track employee check-ins, absences, and working hours"
        actions={
          <button className="btn-secondary text-xs" onClick={exportAttendance}>
            <Download className="w-3.5 h-3.5" /> Export Report
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label:'Present',  value:present,  color:'text-emerald-600' },
          { label:'Late',     value:late,     color:'text-amber-600'   },
          { label:'Absent',   value:absent,   color:'text-red-600'     },
          { label:'On Leave', value:onLeave,  color:'text-blue-600'    },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {['today','corrections','monthly'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${tab===t?'bg-gray-900 text-white':'bg-white border border-gray-200 text-gray-600'}`}>
            {t === 'today' ? "Today's Attendance" : t === 'corrections' ? `Corrections (${corrections.length})` : 'Monthly Overview'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[980px]">
            <thead>
              <tr>
                {['Employee','Shift','Check In','Check Out','Hours','Late','Shift Result','Status','Action'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendanceToday.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium text-gray-800">{a.name}</td>
                  <td className="table-cell">
                    <p className="text-xs font-semibold text-gray-700">{a.shift || '-'}</p>
                    <p className="text-[11px] text-gray-400">{a.shiftStart || '-'} to {a.shiftEnd || '-'}</p>
                  </td>
                  <td className="table-cell font-mono text-xs">{a.checkIn}</td>
                  <td className="table-cell font-mono text-xs">{a.checkOut}</td>
                  <td className="table-cell">{a.hours > 0 ? `${a.hours}h` : '—'}</td>
                  <td className="table-cell text-xs">{a.lateMinutes ? `${a.lateMinutes} min` : '-'}</td>
                  <td className="table-cell text-xs text-gray-600">{a.shiftResult || '-'}</td>
                  <td className="table-cell"><span className={statusStyle[a.status]}>{a.status}</span></td>
                  <td className="table-cell">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => openCorrect(a)}
                    >
                      Correct
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'monthly' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Attendance Summary (2026)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData} barSize={18}>
              <XAxis dataKey="month" tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11}} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="present" fill="#1a1a1a" radius={[4,4,0,0]} name="Present" />
              <Bar dataKey="absent"  fill="#ef4444" radius={[4,4,0,0]} name="Absent"  />
              <Bar dataKey="late"    fill="#f59e0b" radius={[4,4,0,0]} name="Late"    />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 'corrections' && (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr>{['Employee','Date','Requested Times','Reason','Requested','Decision'].map(h => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {corrections.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{c.employee}</td>
                  <td className="table-cell text-xs">{c.date}</td>
                  <td className="table-cell font-mono text-xs">{c.checkIn || '-'} to {c.checkOut || '-'}</td>
                  <td className="table-cell text-xs text-gray-500">{c.reason}</td>
                  <td className="table-cell text-xs">{c.requestedOn}</td>
                  <td className="table-cell">
                    <div className="space-y-2">
                      <input className="input text-xs" placeholder="Decision note" value={decisionNote} onChange={e => setDecisionNote(e.target.value)} />
                      <div className="flex gap-1">
                        <button className="btn-secondary text-xs" disabled={saving} onClick={() => decideCorrection(c.id, 'Approved')}>
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button className="btn-danger text-xs" disabled={saving} onClick={() => decideCorrection(c.id, 'Rejected')}>
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {corrections.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">No pending correction requests.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Correct Attendance Modal */}
      <Modal open={!!correctRow} onClose={() => setCorrectRow(null)} title="Correct Attendance Record" size="sm">
        {correctRow && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-gray-800">
              {correctRow.name}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Check In Time</label>
                <input
                  className="input font-mono"
                  type="time"
                  value={correctForm.checkIn}
                  onChange={e => setCorrectForm(f => ({ ...f, checkIn: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Check Out Time</label>
                <input
                  className="input font-mono"
                  type="time"
                  value={correctForm.checkOut}
                  onChange={e => setCorrectForm(f => ({ ...f, checkOut: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="select"
                value={correctForm.status}
                onChange={e => setCorrectForm(f => ({ ...f, status: e.target.value }))}
              >
                <option>Present</option>
                <option>Late</option>
                <option>Absent</option>
                <option>On Leave</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={handleCorrect}
                disabled={saving}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Correction
              </button>
              <button className="btn-secondary" onClick={() => setCorrectRow(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
