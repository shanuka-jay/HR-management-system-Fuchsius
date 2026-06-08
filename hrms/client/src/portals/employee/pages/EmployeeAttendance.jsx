import React, { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { ChevronLeft, ChevronRight, Clock, Download, LogIn, LogOut, Timer, Loader2 } from 'lucide-react'
import { exportRowsAsCsv } from '../../../components/shared/exportUtils'
import { attendanceApi } from '../../../api/services'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'

export default function EmployeeAttendance() {
  const { employee, loading, isLinked } = useCurrentEmployee()
  const { checkIn, checkOut } = useHR()
  const [attendance, setAttendance] = useState([])
  const [correctionModal, setCorrectionModal] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [weekOffset, setWeekOffset] = useState(0)
  const [correctionForm, setCorrectionForm] = useState({ date: '', checkIn: '', checkOut: '', reason: '' })
  const [correctionMsg, setCorrectionMsg] = useState('')
  const [correctionHistory, setCorrectionHistory] = useState([])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const loadAttendance = async () => {
    if (!employee?.id) return
    const res = await attendanceApi.employee(employee.id)
    setAttendance(res.data || [])
  }

  const loadCorrections = async () => {
    if (!employee?.id) return
    const res = await attendanceApi.corrections()
    setCorrectionHistory(res.data || [])
  }

  useEffect(() => {
    loadAttendance().catch(() => {})
    loadCorrections().catch(() => {})
  }, [employee?.id])

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const formatDuration = (ms) => {
    if (!ms) return '00:00:00'
    const seconds = Math.floor(ms / 1000)
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0')
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  const [checkLoading, setCheckLoading] = useState(false)

  const handleCheck = async () => {
    setCheckLoading(true)
    try {
      const now  = new Date()
      if (!checkedIn) {
        await checkIn()
      } else {
        await checkOut()
      }
      await loadAttendance()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to record attendance')
    } finally {
      setCheckLoading(false)
    }
  }

  const getMonday = (date, offset = 0) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + 1 + offset * 7
    return new Date(d.setDate(diff))
  }

  const weekStart = useMemo(() => getMonday(new Date(), weekOffset), [weekOffset])
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + index)
      const date = d.toISOString().split('T')[0]
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date,
        data: attendance.find(item => item.date === date) || null,
      }
    })
  }, [weekStart, attendance])

  const filteredData = weekDays.filter(item => {
    const matchSearch =
      !search ||
      item.day.toLowerCase().includes(search.toLowerCase()) ||
      item.date.includes(search) ||
      item.data?.status?.toLowerCase().includes(search.toLowerCase())
    const matchDate = !dateFilter || item.date === dateFilter
    return matchSearch && matchDate
  })

  const exportAllAttendance = () => exportRowsAsCsv('attendance-full.csv', attendance.map(item => ({
    Date: item.date,
    Shift: item.shift,
    ShiftStart: item.shiftStart,
    ShiftEnd: item.shiftEnd,
    CheckIn: item.checkIn,
    CheckOut: item.checkOut,
    Hours: item.hours,
    LateMinutes: item.lateMinutes,
    EarlyLeaveMinutes: item.earlyLeaveMinutes,
    ShiftResult: item.shiftResult,
    Status: item.status,
  })))

  const today = new Date().toISOString().slice(0, 10)
  const todayRecord = attendance.find(item => item.date === today)
  const checkedIn = Boolean(todayRecord?.checkIn && todayRecord.checkIn !== '-' && (!todayRecord.checkOut || todayRecord.checkOut === '-'))
  const startTime = useMemo(() => {
    if (!checkedIn || !todayRecord?.checkIn || todayRecord.checkIn === '-') return null
    const [hours, minutes] = todayRecord.checkIn.split(':').map(Number)
    const date = new Date()
    date.setHours(hours || 0, minutes || 0, 0, 0)
    return date
  }, [checkedIn, todayRecord?.checkIn])
  const liveWorked = startTime ? currentTime - startTime : 0
  const currentStatus = checkedIn ? 'Clocked in' : 'Clocked out'
  const todayShiftText = todayRecord?.shift
    ? `${todayRecord.shift} (${todayRecord.shiftStart} to ${todayRecord.shiftEnd})`
    : 'Shift will be assigned when you check in'

  const setCorrection = (key, value) => setCorrectionForm(prev => ({ ...prev, [key]: value }))

  const submitCorrection = async () => {
    setCorrectionMsg('')
    if (!correctionForm.date || !correctionForm.reason.trim()) {
      setCorrectionMsg('Date and reason are required.')
      return
    }
    try {
      await attendanceApi.requestCorrection({
        employeeId: employee.id,
        ...correctionForm,
      })
      await loadCorrections()
      setCorrectionForm({ date: '', checkIn: '', checkOut: '', reason: '' })
      setCorrectionMsg('Correction request submitted.')
      setCorrectionModal(false)
    } catch (err) {
      setCorrectionMsg(err.response?.data?.error || err.message || 'Failed to submit request.')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /> Loading...</div>
  if (!isLinked) return <div className="card p-8 text-center text-sm text-gray-500">No linked employee record found for this account. Please ask HR to link your employee profile.</div>

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        subtitle="Track daily clock-in, request corrections, review weekly records and export attendance."
      />

   <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-6 shadow-xl border border-slate-600">
  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

    {/* Left */}
    <div className="flex items-start gap-4">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          checkedIn
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-white/10 text-white'
        }`}
      >
        <Clock className="w-7 h-7" />
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gray-300 font-bold">
          Live Session
        </p>

        <h2 className="text-2xl font-black text-white mt-1">
          {currentStatus}
        </h2>

        <p className="text-sm text-gray-200 mt-1">
          {checkedIn
            ? `Working since ${startTime?.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`
            : 'Start your session when you begin work'}
        </p>
      </div>
    </div>

    {/* Right Stats */}
    <div className="grid grid-cols-2 gap-4 min-w-[320px]">
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <p className="text-xs uppercase tracking-wider text-gray-300">
          Current Time
        </p>

        <p className="font-mono text-2xl font-bold text-white mt-1">
          {formatTime(currentTime)}
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
        <p className="text-xs uppercase tracking-wider text-gray-300">
          Worked Today
        </p>

        <p className="font-mono text-2xl font-bold text-white mt-1">
          {formatDuration(liveWorked)}
        </p>
      </div>
    </div>
  </div>

  {/* Bottom Action Bar */}
  <div className="mt-6 pt-5 border-t border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={
          checkedIn
            ? 'px-3 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
            : 'px-3 py-1 rounded-full text-xs bg-white/10 text-gray-300 border border-white/10'
        }
      >
        {currentStatus}
      </span>

      <span className="text-sm text-gray-200 font-medium">
        {employee.name} • {employee.dept}
      </span>
      <span className="text-sm text-gray-200 font-medium">
        {todayShiftText}
      </span>
      {todayRecord?.lateMinutes > 0 && (
        <span className="px-3 py-1 rounded-full text-xs bg-amber-500/15 text-amber-200 border border-amber-500/20">
          Late by {todayRecord.lateMinutes} min
        </span>
      )}
      {todayRecord?.shiftResult && (
        <span className="px-3 py-1 rounded-full text-xs bg-white/10 text-gray-200 border border-white/10">
          {todayRecord.shiftResult}
        </span>
      )}
    </div>

    <div className="flex gap-3">
      <button
        onClick={() => setCorrectionModal(true)}
        className="px-4 py-2 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition"
      >
        Request Correction
      </button>

      <button
        onClick={handleCheck}
        disabled={checkLoading}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold transition disabled:opacity-60 ${
          checkedIn
            ? 'bg-white text-gray-900 hover:bg-gray-100'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        {checkLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : checkedIn ? (
          <><LogOut className="w-4 h-4" /> Check Out</>
        ) : (
          <><LogIn className="w-4 h-4" /> Check In</>
        )}
      </button>
    </div>
  </div>
</div>
      <div className="card p-4 flex flex-col lg:flex-row justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input sm:w-64" placeholder="Search day, date or status" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input type="date" className="input sm:w-44" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div>
        <button onClick={exportAllAttendance} className="btn-secondary">
          <Download className="w-4 h-4" />
          Download Full Sheet
        </button>
      </div>

      <div className="flex justify-between items-center">
        <button onClick={() => setWeekOffset(w => w - 1)} className="btn-secondary">
          <ChevronLeft className="w-4 h-4" />
          Prev Week
        </button>
        <p className="text-sm font-semibold text-gray-700">Monday to Sunday</p>
        <button onClick={() => setWeekOffset(w => w + 1)} className="btn-secondary">
          Next Week
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[920px]">
          <thead>
            <tr>{['Day','Date','Shift','Check In','Check Out','Hours','Late','Result','Status'].map(h => <th key={h} className="table-head py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr key={item.date} className="border-b hover:bg-gray-50">
                <td className="table-cell font-semibold">{item.day}</td>
                <td className="table-cell text-gray-500">{item.date}</td>
                <td className="table-cell">
                  <p className="text-xs font-semibold text-gray-700">{item.data?.shift || '-'}</p>
                  {item.data?.shiftStart && <p className="text-[11px] text-gray-400">{item.data.shiftStart} to {item.data.shiftEnd}</p>}
                </td>
                <td className="table-cell text-emerald-600 font-mono text-xs">{item.data?.checkIn || '-'}</td>
                <td className="table-cell text-gray-600 font-mono text-xs">{item.data?.checkOut || '-'}</td>
                <td className="table-cell font-semibold">{item.data ? `${item.data.hours}h` : '-'}</td>
                <td className="table-cell text-xs">{item.data?.lateMinutes ? `${item.data.lateMinutes} min` : '-'}</td>
                <td className="table-cell text-xs text-gray-600">{item.data?.shiftResult || '-'}</td>
                <td className="table-cell">
                  {item.data ? (
                    <span className={item.data.status === 'Present' ? 'badge-green' : item.data.status === 'Late' ? 'badge-yellow' : item.data.status === 'Weekend' ? 'badge-gray' : 'badge-red'}>
                      {item.data.status}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">No record</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Correction Request History</h3>
          <span className="badge-gray">{correctionHistory.length} requests</span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr>{['Date','Requested Times','Reason','Status','Decision'].map(h => <th key={h} className="table-head py-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {correctionHistory.map(item => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="table-cell text-gray-600">{item.date}</td>
                <td className="table-cell font-mono text-xs">{item.checkIn || '-'} to {item.checkOut || '-'}</td>
                <td className="table-cell text-gray-500 max-w-xs truncate">{item.reason}</td>
                <td className="table-cell">
                  <span className={item.status === 'Approved' ? 'badge-green' : item.status === 'Rejected' ? 'badge-red' : 'badge-yellow'}>{item.status}</span>
                </td>
                <td className="table-cell text-xs text-gray-500">{item.decisionNote || item.decidedBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {correctionHistory.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">No correction requests yet.</div>
        )}
      </div>

      <Modal open={correctionModal} onClose={() => setCorrectionModal(false)} title="Request Attendance Correction" size="sm">
        <div className="space-y-4">
          <input className="input" type="date" value={correctionForm.date} onChange={e => setCorrection('date', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="time" value={correctionForm.checkIn} onChange={e => setCorrection('checkIn', e.target.value)} />
            <input className="input" type="time" value={correctionForm.checkOut} onChange={e => setCorrection('checkOut', e.target.value)} />
          </div>
          <textarea className="input" rows={3} placeholder="Reason..." value={correctionForm.reason} onChange={e => setCorrection('reason', e.target.value)} />
          {correctionMsg && <p className="text-xs text-gray-500">{correctionMsg}</p>}
          <button className="btn-primary w-full" onClick={submitCorrection}>
            <Timer className="w-4 h-4" />
            Submit Request
          </button>
        </div>
      </Modal>
    </div>
  )
}
