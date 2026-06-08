import React, { useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { Target, Star, TrendingUp, ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from 'lucide-react'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { performanceApi } from '../../../api/services'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'

const emptyGoal = { id: '', title: '', due: '', progress: 0, status: 'On Track' }

export default function EmployeePerformance() {
  const { performanceReviews, performanceCycles, submitSelfReview, fetchPerformanceReviews } = useHR()
  const { employee, loading, isLinked } = useCurrentEmployee()
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [expandedReview, setExpandedReview] = useState(null)
  const [selfReviewTarget, setSelfReviewTarget] = useState(null)
  const [selfReviewText, setSelfReviewText] = useState('')
  const [myGoals, setMyGoals] = useState([])
  const [goalForm, setGoalForm] = useState(emptyGoal)
  const myReviews = performanceReviews.filter(r => r.empId === employee?.id)
  const activeCycles = performanceCycles.filter(c => c.status === 'In Progress')

  useEffect(() => {
    if (!employee?.id) return
    performanceApi.goals(employee.id).then(res => setMyGoals(res.data || [])).catch(() => {})
  }, [employee?.id])

  const statusColor = s =>
    s === 'Completed' ? 'badge-green' : s === 'On Track' ? 'badge-blue' : 'badge-yellow'

  const progressColor = p =>
    p >= 80 ? '#1a1a1a' : p >= 50 ? '#737373' : '#d1d5db'

  const openGoal = (goal = null) => {
    setGoalForm(goal
      ? { id: goal.id, title: goal.title, due: goal.due, progress: goal.progress || 0, status: goal.status || 'On Track' }
      : emptyGoal)
    setShowGoalModal(true)
  }

  const saveGoal = async () => {
    if (!goalForm.title.trim() || !goalForm.due || !employee?.id) return
    const payload = {
      title: goalForm.title,
      due: goalForm.due,
      progress: Math.max(0, Math.min(100, Number(goalForm.progress) || 0)),
      status: goalForm.status,
    }
    if (payload.progress >= 100) payload.status = 'Completed'

    if (goalForm.id) {
      const res = await performanceApi.updateGoal(goalForm.id, payload)
      setMyGoals(prev => prev.map(goal => goal.id === goalForm.id ? res.data : goal))
    } else {
      const res = await performanceApi.createGoal({ employeeId: employee.id, ...payload })
      setMyGoals(prev => [res.data, ...prev])
    }

    await fetchPerformanceReviews()
    setGoalForm(emptyGoal)
    setShowGoalModal(false)
  }

  const deleteGoal = async (goal) => {
    const confirmed = window.confirm(`Delete goal "${goal.title}"?`)
    if (!confirmed) return
    await performanceApi.deleteGoal(goal.id)
    setMyGoals(prev => prev.filter(item => item.id !== goal.id))
    await fetchPerformanceReviews()
  }

  const openSelfReview = (review) => {
    setSelfReviewTarget(review)
    setSelfReviewText(review.selfReview || '')
  }

  const saveSelfReview = async () => {
    if (!selfReviewTarget || !selfReviewText.trim()) return
    await submitSelfReview(selfReviewTarget.id, selfReviewText)
    setSelfReviewTarget(null)
    setSelfReviewText('')
  }

  const latestRated = myReviews.find(r => r.rating)
  const completedGoals = myGoals.filter(g => g.status === 'Completed' || Number(g.progress) >= 100).length

  if (loading) return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /> Loading...</div>
  if (!isLinked) return <div className="card p-8 text-center text-sm text-gray-500">No linked employee record found for this account. Please ask HR to link your employee profile.</div>

  return (
    <div>
      <PageHeader
        title="My Performance"
        subtitle="Set goals, update progress, submit self reviews, and view final appraisal results."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4 text-center sm:col-span-2">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <span className="text-3xl font-bold text-gray-900">{latestRated?.rating || '-'}</span>
            <span className="text-gray-400 text-sm">/ 5</span>
          </div>
          <p className="text-xs text-gray-500">Latest performance score</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{completedGoals}/{myGoals.length}</p>
          <p className="text-xs text-gray-500">Goals completed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{myGoals.some(g => g.status === 'At Risk') ? 'At Risk' : 'On Track'}</p>
          <p className="text-xs text-gray-500">Current status</p>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Target className="w-4 h-4 text-gray-500" /> My Goals
            </h3>
            <p className="text-xs text-gray-500 mt-1">Goal progress means how much of your current work target is completed.</p>
          </div>
          <button className="btn-secondary text-xs" onClick={() => openGoal()}>
            + Add Goal
          </button>
        </div>
        <div className="space-y-3">
          {myGoals.map(goal => (
            <div key={goal.id} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{goal.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Due: {goal.due}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={statusColor(goal.status)}>{goal.status}</span>
                  <button className="btn-ghost text-xs" title="Edit goal" onClick={() => openGoal(goal)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn-ghost text-xs text-red-500" title="Delete goal" onClick={() => deleteGoal(goal)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ width: `${goal.progress}%`, background: progressColor(goal.progress) }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-600 w-10 text-right">{goal.progress}%</span>
              </div>
            </div>
          ))}
          {myGoals.length === 0 && <p className="text-sm text-gray-400 py-4">No goals yet. Add your first goal for this review period.</p>}
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Active Review Cycles</h3>
        <div className="space-y-2">
          {activeCycles.map(cycle => (
            <div key={cycle.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">{cycle.name}</p>
                <p className="text-xs text-gray-500">{cycle.type} - {cycle.startDate} to {cycle.endDate}</p>
              </div>
              <span className="badge-yellow">{cycle.status}</span>
            </div>
          ))}
          {activeCycles.length === 0 && <p className="text-sm text-gray-400">No active review cycles.</p>}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-500" /> Performance Reviews
        </h3>
        <div className="space-y-3">
          {myReviews.map(r => (
            <div key={r.id} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                onClick={() => setExpandedReview(expandedReview === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 text-left">{r.period} Review</p>
                    <p className="text-xs text-gray-400">Reviewer: {r.reviewer || 'Pending manager review'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={r.status === 'Completed' ? 'badge-green' : 'badge-yellow'}>{r.status}</span>
                  {r.status !== 'Completed' && (
                    <button
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={(event) => { event.stopPropagation(); openSelfReview(r) }}
                    >
                      Self Review
                    </button>
                  )}
                  {r.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold">{r.rating}</span>
                    </div>
                  )}
                  {expandedReview === r.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {expandedReview === r.id && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{r.goals}</p>
                      <p className="text-xs text-gray-500">Goals set</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-emerald-600">{r.completed}</p>
                      <p className="text-xs text-gray-500">Completed</p>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold text-gray-900">{r.rating || '-'}</p>
                      <p className="text-xs text-gray-500">Rating</p>
                    </div>
                  </div>
                  {r.managerFeedback && (
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                      <span className="font-semibold text-gray-700">Manager feedback: </span>{r.managerFeedback}
                    </p>
                  )}
                  {r.selfReview && (
                    <p className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3 mt-2">
                      <span className="font-semibold text-gray-700">My self-review: </span>{r.selfReview}
                    </p>
                  )}
                  {r.improvementAreas && (
                    <p className="text-xs text-gray-500 bg-amber-50 rounded-lg p-3 mt-2">
                      <span className="font-semibold text-gray-700">Growth areas: </span>{r.improvementAreas}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {myReviews.length === 0 && <p className="text-sm text-gray-400 py-4">No performance reviews yet.</p>}
        </div>
      </div>

      <Modal open={showGoalModal} onClose={() => setShowGoalModal(false)} title={goalForm.id ? 'Edit Goal' : 'Add New Goal'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Goal title *</label>
            <input className="input" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete AWS certification" />
          </div>
          <div>
            <label className="label">Due date *</label>
            <input className="input" type="date" value={goalForm.due} onChange={e => setGoalForm(f => ({ ...f, due: e.target.value }))} />
          </div>
          <div>
            <label className="label">Progress</label>
            <input className="input" type="number" min="0" max="100" value={goalForm.progress} onChange={e => setGoalForm(f => ({ ...f, progress: e.target.value }))} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="select" value={goalForm.status} onChange={e => setGoalForm(f => ({ ...f, status: e.target.value }))}>
              <option>On Track</option>
              <option>At Risk</option>
              <option>Completed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button className="btn-primary flex-1" onClick={saveGoal}>{goalForm.id ? 'Save Goal' : 'Add Goal'}</button>
            <button className="btn-secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selfReviewTarget} onClose={() => setSelfReviewTarget(null)} title="Submit Self Review" size="sm">
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            {selfReviewTarget?.period} - describe wins, blockers, lessons learned, and support needed.
          </div>
          <textarea
            className="input"
            rows={6}
            value={selfReviewText}
            onChange={e => setSelfReviewText(e.target.value)}
            placeholder="Write your self-review..."
          />
          <div className="flex gap-3 pt-1">
            <button className="btn-primary flex-1" onClick={saveSelfReview}>Submit Self Review</button>
            <button className="btn-secondary" onClick={() => setSelfReviewTarget(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
