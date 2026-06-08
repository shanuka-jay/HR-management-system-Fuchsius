import React, { useEffect, useMemo, useState } from 'react'
import { Clock, Loader2, LogIn, LogOut } from 'lucide-react'
import { attendanceApi } from '../../api/services'
import { useHR } from '../../context/HRContext'

export default function SelfAttendanceCard({ compact = false }) {
  const { checkIn, checkOut, fetchAttendanceToday, fetchEmployees } = useHR()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await attendanceApi.me()
      setData(res.data)
    } catch (err) {
      setMessage(err.response?.data?.error || 'Unable to load your attendance.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const today = data?.today
  const checkedIn = Boolean(today?.checkIn && today.checkIn !== '-' && (!today.checkOut || today.checkOut === '-'))
  const completed = Boolean(today?.checkIn && today.checkIn !== '-' && today?.checkOut && today.checkOut !== '-')
  const statusText = completed
    ? `Completed ${today.checkIn} to ${today.checkOut}`
    : checkedIn
      ? `Checked in at ${today.checkIn}`
      : 'Not checked in yet'

  const sessionAge = useMemo(() => {
    if (!checkedIn || !today?.checkIn) return ''
    const [hours, minutes] = today.checkIn.split(':').map(Number)
    const start = new Date()
    start.setHours(hours || 0, minutes || 0, 0, 0)
    const diff = Math.max(0, Date.now() - start.getTime())
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m active`
  }, [checkedIn, today?.checkIn])

  const handleAction = async () => {
    setSaving(true)
    setMessage('')
    try {
      const result = checkedIn ? await checkOut() : await checkIn()
      setMessage(result.message || 'Attendance updated.')
      await Promise.all([load(), fetchAttendanceToday(), fetchEmployees()])
    } catch (err) {
      setMessage(err.response?.data?.error || 'Attendance update failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`card ${compact ? 'p-4' : 'p-5'} bg-gray-950 text-white`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">My Attendance</p>
          <h3 className="text-lg font-bold mt-1">{loading ? 'Loading...' : statusText}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {data?.employee ? `${data.employee.name} - ${data.employee.role}` : 'Your own check-in writes to the main attendance sheet.'}
          </p>
          {sessionAge && <p className="text-xs text-emerald-300 mt-2">{sessionAge}</p>}
          {message && <p className="text-xs text-gray-300 mt-2">{message}</p>}
        </div>
        <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
          <Clock className="h-5 w-5 text-white" />
        </div>
      </div>

      <button
        className={`mt-4 w-full ${checkedIn ? 'btn-secondary' : 'btn-primary'}`}
        onClick={handleAction}
        disabled={loading || saving || completed}
        title={completed ? 'Attendance already completed today' : checkedIn ? 'Check out for today' : 'Check in for today'}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : checkedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {completed ? 'Completed Today' : checkedIn ? 'Check Out' : 'Check In'}
      </button>
    </div>
  )
}
