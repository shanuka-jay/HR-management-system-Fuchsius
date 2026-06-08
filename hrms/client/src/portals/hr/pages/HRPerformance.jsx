import React, { useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { performanceApi } from '../../../api/services'
import { Pencil, Play, Plus, Star, Target, Trash2 } from 'lucide-react'

const DEPTS = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']
const REVIEW_STEPS = ['Self Review', 'Manager Review', 'HR Calibration', 'Publish Results', 'Archive']
const progressPercent = (completed, goals) => goals ? Math.round((completed / goals) * 100) : 0

export default function HRPerformance() {
  const {
    performanceReviews, performanceCycles, createPerformanceCycle,
    launchPerformanceCycle, completePerformanceCycle, calibratePerformanceReview,
    fetchPerformanceReviews,
  } = useHR()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewReview, setViewReview]           = useState(null)
  const [calibrateReview, setCalibrateReview] = useState(null)
  const [calibrationForm, setCalibrationForm] = useState({ rating: '', hrCalibration: '', publish: false })
  const [goalsReview, setGoalsReview] = useState(null)
  const [reviewGoals, setReviewGoals] = useState([])
  const [goalForm, setGoalForm] = useState({ id: '', title: '', due: '', progress: 0, status: 'On Track' })
  const [cycleForm, setCycleForm]             = useState({
    name: '', startDate: '', endDate: '', type: 'Quarterly Review', dept: 'All Departments',
  })
  const setC = (k, v) => setCycleForm(f => ({ ...f, [k]: v }))

  const totalReviews = performanceReviews.length
  const selfSubmitted = performanceReviews.filter(r => r.status === 'Self Submitted').length
  const managerReviewed = performanceReviews.filter(r => r.status === 'Manager Reviewed').length
  const calibrated = performanceReviews.filter(r => r.status === 'Calibrated').length
  const completed  = performanceReviews.filter(r => r.status === 'Completed').length
  const ratedReviews = performanceReviews.filter(r => r.rating)
  const avgRating  = ratedReviews.length
    ? (ratedReviews.reduce((s, r) => s + r.rating, 0) / ratedReviews.length).toFixed(1)
    : '—'

  const handleCreateCycle = () => {
    if (!cycleForm.name.trim()) { alert('Cycle name is required.'); return }
    createPerformanceCycle(cycleForm)
    setShowCreateModal(false)
    setCycleForm({ name: '', startDate: '', endDate: '', type: 'Quarterly Review', dept: 'All Departments' })
  }

  const handleCompleteCycle = async (cycleId) => {
    try {
      await completePerformanceCycle(cycleId)
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Could not complete this cycle yet.')
    }
  }

  const openCalibration = (review) => {
    setCalibrateReview(review)
    setCalibrationForm({
      rating: review.rating || '',
      hrCalibration: review.hrCalibration || '',
      publish: review.status === 'Completed',
    })
  }

  const saveCalibration = async () => {
    await calibratePerformanceReview(calibrateReview.id, calibrationForm)
    setCalibrateReview(null)
  }

  const openGoals = async (review) => {
    setGoalsReview(review)
    setGoalForm({ id: '', title: '', due: '', progress: 0, status: 'On Track' })
    const res = await performanceApi.goals(review.empId)
    setReviewGoals(res.data || [])
  }

  const editGoal = (goal) => {
    setGoalForm({
      id: goal.id,
      title: goal.title,
      due: goal.due,
      progress: goal.progress || 0,
      status: goal.status || 'On Track',
    })
  }

  const saveGoal = async () => {
    if (!goalsReview || !goalForm.title.trim() || !goalForm.due) return
    const payload = {
      title: goalForm.title,
      due: goalForm.due,
      progress: Math.max(0, Math.min(100, Number(goalForm.progress) || 0)),
      status: goalForm.status,
    }
    if (payload.progress >= 100) payload.status = 'Completed'

    if (goalForm.id) {
      const res = await performanceApi.updateGoal(goalForm.id, payload)
      setReviewGoals(prev => prev.map(goal => goal.id === goalForm.id ? res.data : goal))
    } else {
      const res = await performanceApi.createGoal({ employeeId: goalsReview.empId, ...payload })
      setReviewGoals(prev => [res.data, ...prev])
    }
    setGoalForm({ id: '', title: '', due: '', progress: 0, status: 'On Track' })
    await fetchPerformanceReviews()
  }

  const deleteGoal = async (goal) => {
    const confirmed = window.confirm(`Delete goal "${goal.title}"?`)
    if (!confirmed) return
    await performanceApi.deleteGoal(goal.id)
    setReviewGoals(prev => prev.filter(item => item.id !== goal.id))
    await fetchPerformanceReviews()
  }

  return (
    <div>
      <PageHeader
        title="Performance Management"
        subtitle="Manage review cycles, KPIs, and employee appraisals"
        actions={
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> New Review Cycle
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        {[
          ['Total Reviews', totalReviews, 'text-gray-900'],
          ['Self Submitted', selfSubmitted, 'text-blue-600'],
          ['Manager Reviewed', managerReviewed, 'text-amber-600'],
          ['Calibrated', calibrated, 'text-emerald-600'],
          ['Completed', completed, 'text-gray-900'],
          ['Average Rating', avgRating, 'text-gray-900'],
        ].map(([label, value, tone]) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-bold ${tone}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400">1. HR creates cycle</p>
            <p className="font-semibold text-gray-800">Example: Q3 2026 Review</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">2. Launch creates reviews</p>
            <p className="font-semibold text-gray-800">One review row per employee</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">3. Goals progress</p>
            <p className="font-semibold text-gray-800">Completed goals / total goals</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">4. Final result</p>
            <p className="font-semibold text-gray-800">Manager review to HR calibration</p>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Review Cycles</h3>
            <p className="text-xs text-gray-500">Cycle workflow: create, launch, collect self reviews, manager reviews, HR calibration, publish.</p>
          </div>
        </div>
        <div className="space-y-3">
          {performanceCycles.map(cycle => (
            <div key={cycle.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{cycle.name}</p>
                  <p className="text-xs text-gray-500">{cycle.type} - {cycle.dept} - {cycle.startDate || 'No start'} to {cycle.endDate || 'No end'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cycle.status === 'In Progress' ? 'badge-yellow' : cycle.status === 'Completed' ? 'badge-green' : 'badge-gray'}>
                    {cycle.status}
                  </span>
                  {cycle.status === 'Draft' && (
                    <button className="btn-secondary text-xs" onClick={() => launchPerformanceCycle(cycle.id)}>
                      <Play className="w-3.5 h-3.5" /> Launch
                    </button>
                  )}
                  {cycle.status === 'In Progress' && (
                    <button className="btn-secondary text-xs" onClick={() => handleCompleteCycle(cycle.id)}>
                      Complete
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-4">
                {(cycle.steps || REVIEW_STEPS).map((step, index) => (
                  <div key={step} className="bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                    <p className="text-xs font-bold text-gray-400">Step {index + 1}</p>
                    <p className="text-xs font-semibold text-gray-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Performance Reviews</h3>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr>
              {['Employee', 'Period', 'Reviewer', 'Goals', 'Progress', 'Rating', 'Status', 'Action'].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {performanceReviews.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium text-gray-800">{r.employee}</td>
                <td className="table-cell text-xs text-gray-500">{r.period}</td>
                <td className="table-cell text-xs text-gray-500">{r.reviewer}</td>
                <td className="table-cell text-center">{r.goals}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-gray-800 h-1.5 rounded-full"
                        style={{ width: `${progressPercent(r.completed, r.goals)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{r.completed}/{r.goals}</span>
                  </div>
                </td>
                <td className="table-cell">
                  {r.rating ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-semibold">{r.rating}</span>
                    </div>
                  ) : <span className="text-gray-400 text-xs">Pending</span>}
                </td>
                <td className="table-cell">
                  <span className={r.status === 'Completed' ? 'badge-green' : 'badge-yellow'}>{r.status}</span>
                </td>
                <td className="table-cell">
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => setViewReview(r)}
                  >View</button>
                  <button
                    className="btn-ghost text-xs ml-1"
                    onClick={() => openGoals(r)}
                  ><Target className="w-3.5 h-3.5" /> Goals</button>
                  <button
                    className="btn-secondary text-xs ml-1"
                    onClick={() => openCalibration(r)}
                  >Calibrate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Review Cycle Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Review Cycle">
        <div className="space-y-4">
          <div>
            <label className="label">Cycle Name *</label>
            <input className="input" value={cycleForm.name} onChange={e => setC('name', e.target.value)} placeholder="e.g. Q3 2026 Performance Review" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input className="input" type="date" value={cycleForm.startDate} onChange={e => setC('startDate', e.target.value)} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input className="input" type="date" value={cycleForm.endDate} onChange={e => setC('endDate', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Review Type</label>
            <select className="select" value={cycleForm.type} onChange={e => setC('type', e.target.value)}>
              {['Quarterly Review', 'Annual Review', 'Probation Review', '360° Review'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <select className="select" value={cycleForm.dept} onChange={e => setC('dept', e.target.value)}>
              <option>All Departments</option>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handleCreateCycle}>Create Cycle</button>
            <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* View Review Detail Modal */}
      <Modal open={!!viewReview} onClose={() => setViewReview(null)} title="Review Details" size="sm">
        {viewReview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-gray-600">{viewReview.employee.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{viewReview.employee}</p>
                <p className="text-xs text-gray-500">{viewReview.period} · Reviewed by {viewReview.reviewer}</p>
              </div>
            </div>

            {/* Goal Progress */}
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">Goal Progress</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gray-900 h-2 rounded-full transition-all"
                      style={{ width: `${progressPercent(viewReview.completed, viewReview.goals)}%` }}
                    />
                  </div>
                <span className="text-sm font-semibold text-gray-700">{viewReview.completed}/{viewReview.goals} goals</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{progressPercent(viewReview.completed, viewReview.goals)}% completion rate</p>
            </div>

            {/* Rating */}
            <div>
              {viewReview.selfReview && (
                <p className="text-xs text-gray-500 bg-blue-50 rounded-lg p-3 mb-3">
                  <span className="font-semibold text-gray-700">Self-review: </span>{viewReview.selfReview}
                </p>
              )}
              {viewReview.managerFeedback && (
                <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-3">
                  <span className="font-semibold text-gray-700">Manager feedback: </span>{viewReview.managerFeedback}
                </p>
              )}
              {viewReview.improvementAreas && (
                <p className="text-xs text-gray-500 bg-amber-50 rounded-lg p-3 mb-3">
                  <span className="font-semibold text-gray-700">Improvement areas: </span>{viewReview.improvementAreas}
                </p>
              )}
              {viewReview.hrCalibration && (
                <p className="text-xs text-gray-500 bg-emerald-50 rounded-lg p-3 mb-3">
                  <span className="font-semibold text-gray-700">HR calibration: </span>{viewReview.hrCalibration}
                </p>
              )}
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">Rating</p>
              {viewReview.rating ? (
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <Star
                        key={s}
                        className={`w-5 h-5 ${s <= Math.round(viewReview.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-gray-900">{viewReview.rating}</span>
                  <span className="text-sm text-gray-500">/ 5.0</span>
                </div>
              ) : (
                <span className="badge-yellow">Awaiting rating</span>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">Status</span>
              <span className={viewReview.status === 'Completed' ? 'badge-green' : 'badge-yellow'}>{viewReview.status}</span>
            </div>

            <button className="btn-secondary w-full" onClick={() => setViewReview(null)}>Close</button>
          </div>
        )}
      </Modal>

      <Modal open={!!calibrateReview} onClose={() => setCalibrateReview(null)} title="HR Calibration" size="sm">
        {calibrateReview && (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
              {calibrateReview.employee} - {calibrateReview.period}. HR can adjust the final rating, add calibration notes, and publish the result to the employee.
            </div>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={calibrationForm.rating}
              onChange={e => setCalibrationForm(f => ({ ...f, rating: e.target.value }))}
              placeholder="Final rating"
            />
            <textarea
              className="input"
              rows={4}
              value={calibrationForm.hrCalibration}
              onChange={e => setCalibrationForm(f => ({ ...f, hrCalibration: e.target.value }))}
              placeholder="Calibration notes"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={calibrationForm.publish}
                onChange={e => setCalibrationForm(f => ({ ...f, publish: e.target.checked }))}
              />
              Publish final result to employee
            </label>
            <div className="flex gap-3 pt-2">
              <button className="btn-primary flex-1" onClick={saveCalibration}>Save Calibration</button>
              <button className="btn-secondary" onClick={() => setCalibrateReview(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!goalsReview} onClose={() => setGoalsReview(null)} title={`Goals - ${goalsReview?.employee || ''}`}>
        {goalsReview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Goals are the work targets used for the progress count. If an employee has 4 goals and 2 are completed, HR sees 2/4 progress.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className="input" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="Goal title" />
              <input className="input" type="date" value={goalForm.due} onChange={e => setGoalForm(f => ({ ...f, due: e.target.value }))} />
              <input className="input" type="number" min="0" max="100" value={goalForm.progress} onChange={e => setGoalForm(f => ({ ...f, progress: e.target.value }))} placeholder="Progress %" />
              <select className="select" value={goalForm.status} onChange={e => setGoalForm(f => ({ ...f, status: e.target.value }))}>
                <option>On Track</option>
                <option>At Risk</option>
                <option>Completed</option>
              </select>
            </div>
            <button className="btn-primary w-full" onClick={saveGoal}>
              {goalForm.id ? 'Save Goal' : 'Add Goal'}
            </button>
            <div className="space-y-2">
              {reviewGoals.map(goal => (
                <div key={goal.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{goal.title}</p>
                      <p className="text-xs text-gray-500">Due {goal.due} - {goal.progress}% - {goal.status}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost text-xs" onClick={() => editGoal(goal)}><Pencil className="w-3.5 h-3.5" /></button>
                      <button className="btn-ghost text-xs text-red-500" onClick={() => deleteGoal(goal)}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
              {reviewGoals.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No goals for this employee yet.</p>}
            </div>
            <button className="btn-secondary w-full" onClick={() => setGoalsReview(null)}>Close</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
