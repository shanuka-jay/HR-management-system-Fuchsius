import React, { useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { Download, Plus, Briefcase, Users, Star, ChevronRight, X, Pencil, Trash2, AlertTriangle } from 'lucide-react'

const STAGES = ['Screening', 'Portfolio Review', 'HR Interview', 'Technical Interview', 'Final Interview', 'Offer Sent', 'Hired']
const DEPTS  = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']

const stageColor = s => {
  if (s === 'Hired')              return 'badge-green'
  if (s === 'Offer Sent')         return 'badge-blue'
  if (s === 'Rejected')           return 'badge-red'
  if (s.includes('Interview'))    return 'badge-yellow'
  return 'badge-gray'
}

export default function HRRecruitment() {
  const {
    employees, jobOpenings, candidates, addJob, closeJob, reopenJob, deleteJob,
    addCandidate, updateCandidate, convertCandidate, moveCandidate, rejectCandidate,
  } = useHR()

  const [view, setView]           = useState('jobs')
  const [jobFilter, setJobFilter] = useState('')
  const [showJobModal, setShowJobModal]     = useState(false)
  const [showCandidateModal, setShowCandidateModal] = useState(false)
  const [showMoveModal, setShowMoveModal]   = useState(null)  // candidate object
  const [showCandModal, setShowCandModal]   = useState(null)  // candidate object
  const [showEditModal, setShowEditModal]   = useState(null)
  const [showConvertModal, setShowConvertModal] = useState(null)
  const [deleteJobModal, setDeleteJobModal] = useState(null)

  // New job form
  const [jobForm, setJobForm] = useState({
    title: '', dept: 'Engineering', type: 'Full-time', location: 'Remote',
    description: '', minSalary: '', maxSalary: '',
  })
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '', phone: '', jobId: '', rating: 3, notes: '', interviewNotes: '', resume: null })
  const [editForm, setEditForm] = useState({})
  const [convertForm, setConvertForm] = useState({})
  const setJF = (k, v) => setJobForm(f => ({ ...f, [k]: v }))
  const setCF = (k, v) => setCandidateForm(f => ({ ...f, [k]: v }))
  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }))
  const setOF = (k, v) => setConvertForm(f => ({ ...f, [k]: v }))

  const splitCandidateName = (name) => {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' }
  }

  const handlePostJob = () => {
    if (!jobForm.title.trim()) { alert('Job title is required.'); return }
    addJob(jobForm)
    setShowJobModal(false)
    setJobForm({ title: '', dept: 'Engineering', type: 'Full-time', location: 'Remote', description: '', minSalary: '', maxSalary: '' })
  }

  const handleDeleteJob = async () => {
    if (!deleteJobModal) return
    await deleteJob(deleteJobModal.id)
    if (jobFilter === deleteJobModal.id) setJobFilter('')
    setDeleteJobModal(null)
  }

  const handleMove = (stage) => {
    moveCandidate(showMoveModal.id, stage)
    setShowMoveModal(null)
  }

  const handleAddCandidate = async () => {
    if (!candidateForm.name.trim() || !candidateForm.jobId) { alert('Candidate name and job are required.'); return }
    await addCandidate(candidateForm)
    setCandidateForm({ name: '', email: '', phone: '', jobId: '', rating: 3, notes: '', interviewNotes: '', resume: null })
    setShowCandidateModal(false)
  }

  const openEditCandidate = (candidate) => {
    setShowEditModal(candidate)
    setEditForm({
      name: candidate.name || '',
      email: candidate.email || '',
      phone: candidate.phone || '',
      jobId: candidate.jobId || '',
      stage: candidate.stage || 'Screening',
      rating: candidate.rating || 3,
      notes: candidate.notes || '',
      interviewNotes: candidate.interviewNotes || '',
      resume: null,
    })
  }

  const handleUpdateCandidate = async () => {
    if (!editForm.name?.trim() || !editForm.jobId) { alert('Candidate name and job are required.'); return }
    await updateCandidate(showEditModal.id, editForm)
    setShowEditModal(null)
    setEditForm({})
  }

  const openConvertCandidate = (candidate) => {
    const names = splitCandidateName(candidate.name)
    const job = jobOpenings.find(j => j.id === candidate.jobId)
    setShowConvertModal(candidate)
    setConvertForm({
      firstName: names.firstName,
      lastName: names.lastName,
      email: candidate.email || '',
      phone: candidate.phone || '',
      dept: job?.dept || 'Engineering',
      role: job?.title || candidate.job || '',
      manager: '',
      salary: job?.minSalary || '',
      joinDate: new Date().toISOString().slice(0, 10),
      employmentType: job?.type || 'Full-time',
      password: '',
      confirmPassword: '',
    })
  }

  const handleConvertCandidate = async () => {
    if (!convertForm.password || convertForm.password.length < 8) { alert('Password must be at least 8 characters.'); return }
    if (convertForm.password !== convertForm.confirmPassword) { alert('Passwords do not match.'); return }
    await convertCandidate(showConvertModal.id, convertForm)
    setShowConvertModal(null)
    setConvertForm({})
  }

  const activeJobs   = jobOpenings.filter(j => j.status === 'Active').length
  const totalApps    = jobOpenings.reduce((s, j) => s + j.applicants, 0)
  const hiredCount   = candidates.filter(c => c.status === 'Hired').length
  const visibleCandidates = jobFilter ? candidates.filter(c => c.jobId === jobFilter) : candidates
  const activeFilterJob = jobOpenings.find(j => j.id === jobFilter)

  return (
    <div>
      <PageHeader
        title="Recruitment"
        subtitle="Manage job postings, applications, and hiring pipeline"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={() => setShowCandidateModal(true)}>
              <Users className="w-3.5 h-3.5" /> Add Candidate
            </button>
            <button className="btn-primary" onClick={() => setShowJobModal(true)}>
              <Plus className="w-4 h-4" /> Post Job
            </button>
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{activeJobs}</p>
          <p className="text-xs text-gray-500">Active Openings</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{candidates.length}</p>
          <p className="text-xs text-gray-500">Total Candidates</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{hiredCount}</p>
          <p className="text-xs text-gray-500">Hired</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setView('jobs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'jobs' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Briefcase className="w-3.5 h-3.5 inline mr-1.5" />Job Openings
        </button>
        <button onClick={() => setView('pipeline')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === 'pipeline' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <Users className="w-3.5 h-3.5 inline mr-1.5" />Candidates
        </button>
      </div>

      {view === 'jobs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobOpenings.map(job => (
            <div key={job.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{job.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{job.dept} · {job.location} · {job.type}</p>
                </div>
                <span className={job.status === 'Active' ? 'badge-green' : 'badge-gray'}>{job.status}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span><Users className="w-3 h-3 inline mr-1" />{job.applicants} applicants</span>
                <span>Posted {job.posted}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  className="btn-secondary text-xs flex-1"
                  onClick={() => { setJobFilter(job.id); setView('pipeline') }}
                >
                  View Applications
                </button>
                {job.status === 'Active' ? (
                  <button
                    className="btn-ghost text-xs text-red-500 hover:bg-red-50"
                    onClick={() => closeJob(job.id)}
                  >Close</button>
                ) : (
                  <button
                    className="btn-ghost text-xs text-emerald-600 hover:bg-emerald-50"
                    onClick={() => reopenJob(job.id)}
                  >Reopen</button>
                )}
                <button
                  className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                  title="Delete this job opening"
                  onClick={() => setDeleteJobModal(job)}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'pipeline' && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                {activeFilterJob ? `${activeFilterJob.title} Applications` : 'All Candidates'}
              </h3>
              <p className="text-xs text-gray-400">{visibleCandidates.length} candidate{visibleCandidates.length === 1 ? '' : 's'} shown</p>
            </div>
            {jobFilter && (
              <button className="btn-secondary text-xs" onClick={() => setJobFilter('')}>Clear Filter</button>
            )}
          </div>
          <table className="w-full text-left">
            <thead>
              <tr>
                {['Candidate', 'Applied For', 'Stage', 'Applied On', 'Rating', 'Actions'].map(h => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleCandidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">{c.name.charAt(0)}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{c.job}</td>
                  <td className="table-cell"><span className={stageColor(c.stage)}>{c.stage}</span></td>
                  <td className="table-cell text-xs text-gray-400">{c.applied}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= c.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="table-cell">
                    {c.status !== 'Rejected' && c.status !== 'Hired' && (
                      <div className="flex gap-1">
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition font-medium"
                          onClick={() => setShowMoveModal(c)}
                        >
                          <ChevronRight className="w-3 h-3" />Move
                        </button>
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                          onClick={() => setShowCandModal(c)}
                        >Profile</button>
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
                          onClick={() => openEditCandidate(c)}
                        ><Pencil className="w-3 h-3" />Edit</button>
                        {c.stage === 'Hired' && (
                          <button
                            className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition font-medium"
                            onClick={() => openConvertCandidate(c)}
                          >Onboard</button>
                        )}
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium"
                          onClick={() => rejectCandidate(c.id)}
                        >
                          <X className="w-3 h-3" />Reject
                        </button>
                      </div>
                    )}
                    {(c.status === 'Hired' || c.status === 'Rejected') && (
                      <div className="flex gap-1">
                        <button className="btn-ghost text-xs" onClick={() => setShowCandModal(c)}>View</button>
                        <button className="btn-ghost text-xs" onClick={() => openEditCandidate(c)}>Edit</button>
                        {c.status === 'Hired' && <button className="btn-ghost text-xs" onClick={() => openConvertCandidate(c)}>Onboard</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Post Job Modal */}
      <Modal open={showJobModal} onClose={() => setShowJobModal(false)} title="Post New Job Opening" size="md">
        <div className="space-y-4">
          <div>
            <label className="label">Job Title *</label>
            <input className="input" value={jobForm.title} onChange={e => setJF('title', e.target.value)} placeholder="e.g. Senior React Developer" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <select className="select" value={jobForm.dept} onChange={e => setJF('dept', e.target.value)}>
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Employment Type</label>
              <select className="select" value={jobForm.type} onChange={e => setJF('type', e.target.value)}>
                {['Full-time', 'Part-time', 'Contract', 'Intern'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Location</label>
            <select className="select" value={jobForm.location} onChange={e => setJF('location', e.target.value)}>
              <option>Remote</option><option>On-site</option><option>Hybrid</option>
            </select>
          </div>
          <div>
            <label className="label">Job Description</label>
            <textarea className="input" rows={3} value={jobForm.description} onChange={e => setJF('description', e.target.value)} placeholder="Describe the role, responsibilities, and requirements…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Min Monthly Salary (LKR)</label>
              <input className="input" type="number" value={jobForm.minSalary} onChange={e => setJF('minSalary', e.target.value)} placeholder="200000" />
            </div>
            <div>
              <label className="label">Max Monthly Salary (LKR)</label>
              <input className="input" type="number" value={jobForm.maxSalary} onChange={e => setJF('maxSalary', e.target.value)} placeholder="300000" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handlePostJob}>Post Job</button>
            <button className="btn-secondary" onClick={() => setShowJobModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteJobModal} onClose={() => setDeleteJobModal(null)} title="Delete Job Opening" size="sm">
        {deleteJobModal && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{deleteJobModal.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {deleteJobModal.applicants > 0
                    ? `This posting has ${deleteJobModal.applicants} applicant${deleteJobModal.applicants === 1 ? '' : 's'}, so it will be archived and removed from open job lists while candidate history stays available.`
                    : 'This posting has no applicants, so it can be permanently deleted.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-primary flex-1 bg-red-600 hover:bg-red-700" onClick={handleDeleteJob}>
                {deleteJobModal.applicants > 0 ? 'Archive Job' : 'Delete Job'}
              </button>
              <button className="btn-secondary" onClick={() => setDeleteJobModal(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Move Stage Modal */}
      <Modal open={!!showMoveModal} onClose={() => setShowMoveModal(null)} title="Move to Stage" size="sm">
        {showMoveModal && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-3">
              Move <strong>{showMoveModal.name}</strong> to:
            </p>
            {STAGES.map(stage => (
              <button
                key={stage}
                onClick={() => handleMove(stage)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition border ${
                  showMoveModal.stage === stage
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {stage === showMoveModal.stage && '✓ '}
                {stage}
              </button>
            ))}
            <button className="btn-secondary w-full mt-2" onClick={() => setShowMoveModal(null)}>Cancel</button>
          </div>
        )}
      </Modal>

      {/* Candidate Profile Modal */}
      <Modal open={!!showCandModal} onClose={() => setShowCandModal(null)} title="Candidate Profile" size="sm">
        {showCandModal && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-gray-600">{showCandModal.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{showCandModal.name}</p>
                <p className="text-xs text-gray-500">{showCandModal.job}</p>
              </div>
            </div>
            {[
              ['Current Stage',  showCandModal.stage],
              ['Applied On',     showCandModal.applied],
              ['Status',         showCandModal.status],
              ['Email',          showCandModal.email || '-'],
              ['Phone',          showCandModal.phone || '-'],
              ['Resume',         showCandModal.resumeUrl ? 'Uploaded' : 'Not uploaded'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-500">{k}</span>
                <span className="font-medium text-gray-800">{v}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-gray-500">Rating:</span>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= showCandModal.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
            </div>
            {showCandModal.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{showCandModal.notes}</p>}
            {showCandModal.interviewNotes && <p className="text-xs text-gray-500 bg-amber-50 rounded-lg p-3">{showCandModal.interviewNotes}</p>}
            {showCandModal.resumeUrl && (
              <button className="btn-secondary w-full" onClick={() => window.open(showCandModal.resumeUrl, '_blank')}>
                <Download className="w-4 h-4" /> Open Resume
              </button>
            )}
            <button className="btn-secondary w-full mt-2" onClick={() => setShowCandModal(null)}>Close</button>
          </div>
        )}
      </Modal>

      <Modal open={showCandidateModal} onClose={() => setShowCandidateModal(false)} title="Add Candidate" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Candidate Name *</label>
            <input className="input" value={candidateForm.name} onChange={e => setCF('name', e.target.value)} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" value={candidateForm.email} onChange={e => setCF('email', e.target.value)} placeholder="Email" />
            <input className="input" value={candidateForm.phone} onChange={e => setCF('phone', e.target.value)} placeholder="Phone" />
          </div>
          <div>
            <label className="label">Applied Job *</label>
            <select className="select" value={candidateForm.jobId} onChange={e => setCF('jobId', e.target.value)}>
              <option value="">Select job</option>
              {jobOpenings.filter(j => j.status === 'Active').map(job => (
                <option key={job.id} value={job.id}>{job.title} - {job.dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Initial Rating</label>
            <select className="select" value={candidateForm.rating} onChange={e => setCF('rating', e.target.value)}>
              {[1,2,3,4,5].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Resume</label>
            <input className="input" type="file" accept=".pdf,.doc,.docx" onChange={e => setCF('resume', e.target.files?.[0] || null)} />
          </div>
          <textarea className="input" rows={2} value={candidateForm.notes} onChange={e => setCF('notes', e.target.value)} placeholder="Candidate notes" />
          <textarea className="input" rows={2} value={candidateForm.interviewNotes} onChange={e => setCF('interviewNotes', e.target.value)} placeholder="Interview notes" />
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handleAddCandidate}>Add Candidate</button>
            <button className="btn-secondary" onClick={() => setShowCandidateModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showEditModal} onClose={() => setShowEditModal(null)} title="Edit Candidate" size="sm">
        <div className="space-y-4">
          <input className="input" value={editForm.name || ''} onChange={e => setEF('name', e.target.value)} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" value={editForm.email || ''} onChange={e => setEF('email', e.target.value)} placeholder="Email" />
            <input className="input" value={editForm.phone || ''} onChange={e => setEF('phone', e.target.value)} placeholder="Phone" />
          </div>
          <select className="select" value={editForm.jobId || ''} onChange={e => setEF('jobId', e.target.value)}>
            <option value="">Select job</option>
            {jobOpenings.map(job => <option key={job.id} value={job.id}>{job.title} - {job.dept}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select className="select" value={editForm.stage || 'Screening'} onChange={e => setEF('stage', e.target.value)}>
              {STAGES.concat('Rejected').map(stage => <option key={stage}>{stage}</option>)}
            </select>
            <select className="select" value={editForm.rating || 3} onChange={e => setEF('rating', e.target.value)}>
              {[1,2,3,4,5].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <textarea className="input" rows={2} value={editForm.notes || ''} onChange={e => setEF('notes', e.target.value)} placeholder="Candidate notes" />
          <textarea className="input" rows={3} value={editForm.interviewNotes || ''} onChange={e => setEF('interviewNotes', e.target.value)} placeholder="Interview notes" />
          <input className="input" type="file" accept=".pdf,.doc,.docx" onChange={e => setEF('resume', e.target.files?.[0] || null)} />
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handleUpdateCandidate}>Save Candidate</button>
            <button className="btn-secondary" onClick={() => setShowEditModal(null)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showConvertModal} onClose={() => setShowConvertModal(null)} title="Onboard Candidate as Employee" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" value={convertForm.firstName || ''} onChange={e => setOF('firstName', e.target.value)} placeholder="First name" />
            <input className="input" value={convertForm.lastName || ''} onChange={e => setOF('lastName', e.target.value)} placeholder="Last name" />
            <input className="input" value={convertForm.email || ''} onChange={e => setOF('email', e.target.value)} placeholder="Email/login" />
            <input className="input" value={convertForm.phone || ''} onChange={e => setOF('phone', e.target.value)} placeholder="Phone" />
            <select className="select" value={convertForm.dept || ''} onChange={e => setOF('dept', e.target.value)}>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
            <input className="input" value={convertForm.role || ''} onChange={e => setOF('role', e.target.value)} placeholder="Job title" />
            <select className="select" value={convertForm.manager || ''} onChange={e => setOF('manager', e.target.value)}>
              <option value="">No manager</option>
              {employees.filter(e => e.status === 'Active').map(emp => <option key={emp.id} value={emp.name}>{emp.name} - {emp.role}</option>)}
            </select>
            <select className="select" value={convertForm.employmentType || 'Full-time'} onChange={e => setOF('employmentType', e.target.value)}>
              {['Full-time', 'Part-time', 'Contract', 'Intern'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input className="input" type="number" value={convertForm.salary || ''} onChange={e => setOF('salary', e.target.value)} placeholder="Monthly salary (LKR)" />
            <input className="input" type="date" value={convertForm.joinDate || ''} onChange={e => setOF('joinDate', e.target.value)} />
            <input className="input" type="password" value={convertForm.password || ''} onChange={e => setOF('password', e.target.value)} placeholder="Initial password" />
            <input className="input" type="password" value={convertForm.confirmPassword || ''} onChange={e => setOF('confirmPassword', e.target.value)} placeholder="Confirm password" />
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            This creates the employee profile and login account. The employee can sign in with the email above and change the password from their profile.
          </div>
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handleConvertCandidate}>Create Employee Login</button>
            <button className="btn-secondary" onClick={() => setShowConvertModal(null)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
