import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader'
import { useHR } from '../../../context/HRContext'
import useManagerTeam from '../../../hooks/useManagerTeam'
import { attendanceApi, performanceApi } from '../../../api/services'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  Phone,
  Star,
  Target,
  UserRound,
} from 'lucide-react'

const pct = (done, total) => total ? Math.round((Number(done || 0) / Number(total || 0)) * 100) : 0

const statusBadge = (status) => {
  if (status === 'Completed' || status === 'Manager Reviewed') return 'badge-green'
  if (status === 'Calibrated' || status === 'Self Submitted') return 'badge-blue'
  return 'badge-yellow'
}

const Stat = ({ icon: Icon, label, value, tone = 'text-gray-900' }) => (
  <div className="card p-4">
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-gray-100 p-2 text-gray-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-1 text-lg font-bold ${tone}`}>{value}</p>
      </div>
    </div>
  </div>
)

export default function ManagerEmployeeReview() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { employees, leaveRequests, performanceReviews, updatePerformanceReview } = useHR()
  const { teamIds } = useManagerTeam()
  const [attendance, setAttendance] = useState([])
  const [goals, setGoals] = useState([])
  const [activeReviewId, setActiveReviewId] = useState('')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [managerFeedback, setManagerFeedback] = useState('')
  const [improvementAreas, setImprovementAreas] = useState('')
  const [recommendation, setRecommendation] = useState('No Change')
  const [saving, setSaving] = useState(false)

  const employee = employees.find(emp => emp.id === employeeId)
  const isDirectReport = teamIds.includes(employeeId)

  const employeeReviews = useMemo(
    () => performanceReviews.filter(review => review.empId === employeeId),
    [performanceReviews, employeeId]
  )

  const activeReview = useMemo(() => {
    if (activeReviewId) return employeeReviews.find(review => review.id === activeReviewId)
    return employeeReviews.find(review => review.status !== 'Completed') || employeeReviews[0]
  }, [activeReviewId, employeeReviews])

  const employeeLeaves = useMemo(
    () => leaveRequests.filter(leave => leave.empId === employeeId),
    [leaveRequests, employeeId]
  )

  const attendanceSummary = useMemo(() => {
    const late = attendance.filter(row => row.status === 'Late').length
    const absent = attendance.filter(row => row.status === 'Absent').length
    const early = attendance.filter(row => Number(row.earlyLeaveMinutes || 0) > 0).length
    const present = attendance.filter(row => row.status === 'Present' || row.status === 'Late').length
    return { late, absent, early, present }
  }, [attendance])

  const leaveSummary = useMemo(() => {
    const approved = employeeLeaves.filter(leave => leave.status === 'Approved').reduce((sum, leave) => sum + Number(leave.days || 0), 0)
    const pending = employeeLeaves.filter(leave => leave.status === 'Pending' || leave.status === 'Pending HR').length
    return { approved, pending }
  }, [employeeLeaves])

  useEffect(() => {
    if (!employeeId || !isDirectReport) return
    attendanceApi.employee(employeeId)
      .then(res => setAttendance(res.data || []))
      .catch(() => setAttendance([]))
    performanceApi.goals(employeeId)
      .then(res => setGoals(res.data || []))
      .catch(() => setGoals([]))
  }, [employeeId, isDirectReport])

  useEffect(() => {
    if (!activeReview) return
    setActiveReviewId(activeReview.id)
    setRating(activeReview.rating || 0)
    setManagerFeedback(activeReview.managerFeedback || '')
    setImprovementAreas(activeReview.improvementAreas || '')
    setRecommendation(activeReview.recommendation || 'No Change')
  }, [activeReview?.id])

  const submitReview = async () => {
    if (!activeReview || !rating) return
    setSaving(true)
    try {
      await updatePerformanceReview(activeReview.id, {
        rating,
        status: 'Manager Reviewed',
        completed: activeReview.goals,
        managerFeedback,
        improvementAreas,
        recommendation,
      })
    } finally {
      setSaving(false)
    }
  }

  if (!employee || !isDirectReport) {
    return (
      <div>
        <PageHeader title="Employee Review" subtitle="This employee is not in your direct reporting team." />
        <button className="btn-secondary" onClick={() => navigate('/manager/team')}>
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        meta="Manager review"
        title={`${employee.name} Review`}
        subtitle="Profile context, attendance, leave, goals, and manager appraisal in one focused view."
        actions={
          <button className="btn-secondary" onClick={() => navigate('/manager/team')}>
            <ArrowLeft className="h-4 w-4" /> Team
          </button>
        }
      />

      <div className="card mb-6 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-gray-200">
              {employee.avatar ? (
                <img src={employee.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-gray-600">{employee.name.charAt(0)}</span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-950">{employee.name}</h3>
              <p className="text-sm text-gray-500">{employee.role} - {employee.dept}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" /> {employee.id}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Joined {employee.joined}</span>
                <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {employee.email}</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {employee.phone || '-'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:w-[32rem]">
            <div>
              <p className="text-xs text-gray-400">Status</p>
              <p className="font-semibold text-gray-800">{employee.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Type</p>
              <p className="font-semibold text-gray-800">{employee.employmentType || 'Full-time'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Leave Balance</p>
              <p className="font-semibold text-gray-800">{employee.leaveBalance} days</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Manager</p>
              <p className="font-semibold text-gray-800">{employee.manager || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-strip">
        <Stat icon={Target} label="Goals Progress" value={`${activeReview?.completed || 0}/${activeReview?.goals || goals.length}`} />
        <Stat icon={Clock} label="Late Days" value={attendanceSummary.late} tone={attendanceSummary.late ? 'text-amber-600' : 'text-gray-900'} />
        <Stat icon={FileText} label="Approved Leave" value={`${leaveSummary.approved}d`} />
        <Stat icon={CheckCircle2} label="Present Records" value={attendanceSummary.present} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800">Review History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr>
                    {['Cycle', 'Goals', 'Rating', 'Status', 'Reviewer', 'Action'].map(head => (
                      <th key={head} className="table-head">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employeeReviews.map(review => (
                    <tr key={review.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-gray-800">{review.period}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-gray-200">
                            <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${pct(review.completed, review.goals)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{review.completed}/{review.goals}</span>
                        </div>
                      </td>
                      <td className="table-cell">{review.rating || '-'}</td>
                      <td className="table-cell"><span className={statusBadge(review.status)}>{review.status}</span></td>
                      <td className="table-cell text-xs text-gray-500">{review.reviewer || '-'}</td>
                      <td className="table-cell">
                        <button className="btn-ghost text-xs" onClick={() => setActiveReviewId(review.id)}>Open</button>
                      </td>
                    </tr>
                  ))}
                  {employeeReviews.length === 0 && (
                    <tr>
                      <td colSpan={6} className="table-cell py-8 text-center text-gray-400">
                        No review cycle has been launched for this employee yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Current Goals</h3>
              <div className="space-y-3">
                {goals.slice(0, 5).map(goal => (
                  <div key={goal.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{goal.title}</p>
                        <p className="text-xs text-gray-400">Due {goal.due}</p>
                      </div>
                      <span className={goal.status === 'Completed' ? 'badge-green' : goal.status === 'At Risk' ? 'badge-red' : 'badge-yellow'}>{goal.status}</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-gray-200">
                      <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${goal.progress || 0}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-400">{goal.progress || 0}% complete</p>
                  </div>
                ))}
                {goals.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No goals are assigned yet.</p>}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Recent Attendance</h3>
              <div className="space-y-2">
                {attendance.slice(0, 6).map(row => (
                  <div key={row.date} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-gray-700">{row.date}</p>
                      <p className="text-gray-400">{row.shift || 'Shift'} - {row.checkIn} to {row.checkOut}</p>
                    </div>
                    <span className={row.status === 'Present' ? 'badge-green' : row.status === 'Late' ? 'badge-yellow' : row.status === 'On Leave' ? 'badge-blue' : 'badge-red'}>
                      {row.status}
                    </span>
                  </div>
                ))}
                {attendance.length === 0 && <p className="py-4 text-center text-sm text-gray-400">No attendance records yet.</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800">Manager Appraisal</h3>
          {activeReview ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Selected Cycle</p>
                <p className="mt-1 font-semibold text-gray-900">{activeReview.period}</p>
                <p className="mt-1 text-xs text-gray-500">{activeReview.status} - {activeReview.completed}/{activeReview.goals} goals complete</p>
              </div>

              <div>
                <label className="label">Overall Rating</label>
                <div className="mt-2 flex gap-2">
                  {[1, 2, 3, 4, 5].map(score => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setRating(score)}
                      onMouseEnter={() => setHoverRating(score)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="rounded-md p-1 transition hover:bg-gray-100"
                    >
                      <Star className={`h-8 w-8 ${score <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Strengths</label>
                <textarea className="input" rows={3} value={managerFeedback} onChange={e => setManagerFeedback(e.target.value)} placeholder="What did this employee do well?" />
              </div>

              <div>
                <label className="label">Areas for Improvement</label>
                <textarea className="input" rows={3} value={improvementAreas} onChange={e => setImprovementAreas(e.target.value)} placeholder="What should improve next cycle?" />
              </div>

              <div>
                <label className="label">Recommendation</label>
                <select className="select" value={recommendation} onChange={e => setRecommendation(e.target.value)}>
                  <option>No Change</option>
                  <option>Promotion Recommended</option>
                  <option>Salary Increase</option>
                  <option>Performance Improvement Plan</option>
                </select>
              </div>

              {activeReview.selfReview && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">Employee self-review: </span>{activeReview.selfReview}
                </div>
              )}

              <button className="btn-primary w-full" onClick={submitReview} disabled={!rating || saving}>
                Submit Manager Review
              </button>
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
              No active performance review is available. HR must create and launch a review cycle before the manager can submit an appraisal.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
