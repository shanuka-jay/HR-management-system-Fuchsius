import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useHR } from '../../../context/HRContext'
import { attendanceApi, employeesApi, payrollApi } from '../../../api/services'
import Modal from '../../../components/shared/Modal'
import AvatarUploader from '../../../components/shared/AvatarUploader'
import DocumentVault from '../../../components/shared/DocumentVault'
import { leaveStatusClass, leaveStatusLabel } from '../../../utils/leaveStatus'
import { formatCurrency } from '../../../utils/currency'
import {
  ArrowLeft, Mail, Phone, Building2, Calendar,
  Edit2, Trash2, AlertTriangle, Save,
} from 'lucide-react'

const tabs = ['Overview', 'Attendance', 'Leave', 'Payroll', 'Performance', 'Documents']
const DEPTS = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']

export default function HREmployeeProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { employees, leaveRequests, performanceReviews, editEmployee, deleteEmployee, permanentlyDeleteEmployee, fetchEmployees } = useHR()

  const emp = employees.find(e => e.id === id)

  const [tab, setTab]         = useState('Overview')
  const [showEdit, setShowEdit]     = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [payslips, setPayslips] = useState([])
  const [attendance, setAttendance] = useState([])
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [managerOptions, setManagerOptions] = useState([])

  // Edit form state
  const [editForm, setEditForm] = useState(null)

  const openEdit = () => {
    setEditForm({
      name:          emp.name,
      email:         emp.email,
      phone:         emp.phone,
      dept:          emp.dept,
      role:          emp.role,
      manager:       emp.manager,
      salary:        emp.salary,
      status:        emp.status,
      leaveBalance: emp.leaveBalance,
      joined:        emp.joined,
    })
    setShowEdit(true)
  }

  const setEF = (k, v) => setEditForm(f => ({ ...f, [k]: v }))

  const handleSaveEdit = () => {
    if (!editForm.name || !editForm.email || !editForm.dept || !editForm.role) {
      alert('Name, email, department and role are required.')
      return
    }
    editEmployee(id, { ...editForm, salary: parseInt(editForm.salary, 10) || 0 })
    setShowEdit(false)
  }

  const handleDelete = () => {
    deleteEmployee(id)
    navigate('/hr/employees')
  }

  const handlePermanentDelete = async () => {
    const confirmed = await window.fuchsiusConfirm(`Permanently delete ${emp.name} and all linked HR records? This cannot be undone.`, {
      title: 'Permanently Delete Employee',
      confirmLabel: 'Delete Permanently',
    })
    if (!confirmed) return
    await permanentlyDeleteEmployee(id)
    navigate('/hr/employees')
  }

  useEffect(() => {
    if (!emp?.id) return
    payrollApi.list({ employeeId: emp.id }).then(res => setPayslips(res.data || [])).catch(() => setPayslips([]))
    attendanceApi.employee(emp.id).then(res => setAttendance(res.data || [])).catch(() => setAttendance([]))
  }, [emp?.id])

  useEffect(() => {
    employeesApi.managers()
      .then(res => setManagerOptions(res.data || []))
      .catch(() => setManagerOptions([]))
  }, [])

  if (!emp) {
    return (
      <div className="text-center py-24">
        <p className="text-gray-500 mb-4">Employee not found.</p>
        <Link to="/hr/employees" className="btn-primary">Back to Employees</Link>
      </div>
    )
  }

  const empLeaves  = leaveRequests.filter(l => l.empId === emp.id)
  const empReviews = performanceReviews.filter(r => r.empId === emp.id)
  const activeManagers = managerOptions.filter(manager => manager.name !== emp.name && manager.id !== emp.id)
  const attendanceStats = attendance.reduce((acc, row) => ({
    present: acc.present + (row.status === 'Present' ? 1 : 0),
    absent: acc.absent + (row.status === 'Absent' ? 1 : 0),
    late: acc.late + (row.status === 'Late' ? 1 : 0),
  }), { present: 0, absent: 0, late: 0 })

  const uploadAvatar = async (file) => {
    setAvatarLoading(true)
    try {
      await employeesApi.uploadAvatar(emp.id, file)
      await fetchEmployees()
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to upload profile picture')
    } finally {
      setAvatarLoading(false)
    }
  }

  const removeAvatar = async () => {
    const confirmed = await window.fuchsiusConfirm('Remove this employee profile picture?', {
      title: 'Remove Profile Picture',
      confirmLabel: 'Remove',
    })
    if (!confirmed) return
    setAvatarLoading(true)
    try {
      await employeesApi.deleteAvatar(emp.id)
      await fetchEmployees()
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to remove profile picture')
    } finally {
      setAvatarLoading(false)
    }
  }

  return (
    <div>
      <Link to="/hr/employees" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Employees
      </Link>

      {/* Profile header */}
      <div className="card p-6 mb-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <AvatarUploader
            name={emp.name}
            avatar={emp.avatar}
            loading={avatarLoading}
            onFile={uploadAvatar}
            onRemove={removeAvatar}
          />
          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{emp.name}</h2>
                <p className="text-sm text-gray-500">{emp.role} · {emp.dept}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={emp.status === 'Active' ? 'badge-green' : emp.status === 'On Leave' ? 'badge-yellow' : 'badge-red'}>
                  {emp.status}
                </span>
                <button className="btn-secondary text-xs" onClick={openEdit}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition font-medium"
                  onClick={() => setShowDelete(true)}
                  title="Delete/deactivate this employee and block login access"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete / Deactivate
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2 text-xs text-gray-500"><Mail className="w-3.5 h-3.5" />{emp.email}</div>
              <div className="flex items-center gap-2 text-xs text-gray-500"><Phone className="w-3.5 h-3.5" />{emp.phone}</div>
              <div className="flex items-center gap-2 text-xs text-gray-500"><Building2 className="w-3.5 h-3.5" />{emp.dept}</div>
              <div className="flex items-center gap-2 text-xs text-gray-500"><Calendar className="w-3.5 h-3.5" />Joined {emp.joined}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === 'Overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Employee ID',   value: emp.id },
            { label: 'Monthly Salary', value: formatCurrency(emp.salary) },
            { label: 'Manager',       value: emp.manager },
            { label: 'Leave Balance', value: `${emp.leaveBalance} days` },
            { label: 'Join Date',     value: emp.joined },
            { label: 'Department',    value: emp.dept },
          ].map(({ label, value }) => (
            <div key={label} className="card p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Leave */}
      {tab === 'Leave' && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead><tr>{['Type', 'From', 'To', 'Days', 'Status'].map(h => <th key={h} className="table-head">{h}</th>)}</tr></thead>
            <tbody>
              {empLeaves.length === 0
                ? <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No leave records</td></tr>
                : empLeaves.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="table-cell">{l.type}</td>
                    <td className="table-cell">{l.start}</td>
                    <td className="table-cell">{l.end}</td>
                    <td className="table-cell">{l.days}</td>
                    <td className="table-cell">
                      <span className={leaveStatusClass(l.status)}>{leaveStatusLabel(l.status)}</span>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Performance */}
      {tab === 'Performance' && (
        <div className="space-y-3">
          {empReviews.length === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No performance reviews yet</p>
            : empReviews.map(r => (
              <div key={r.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.period} Review</p>
                  <p className="text-xs text-gray-500">Reviewer: {r.reviewer} · Goals: {r.completed}/{r.goals}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={r.status === 'Completed' ? 'badge-green' : 'badge-yellow'}>{r.status}</span>
                  {r.rating && <span className="text-sm font-bold text-gray-900">{r.rating} / 5</span>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Tab: Payroll */}
      {tab === 'Payroll' && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead><tr>{['Period', 'Gross', 'Deductions', 'Net Pay', 'Status'].map(h => <th key={h} className="table-head">{h}</th>)}</tr></thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{p.month}</td>
                  <td className="table-cell">{formatCurrency(p.gross, p.currency)}</td>
                  <td className="table-cell text-red-600">-{formatCurrency(p.deductions, p.currency)}</td>
                  <td className="table-cell font-semibold">{formatCurrency(p.net, p.currency)}</td>
                  <td className="table-cell"><span className="badge-green">Paid</span></td>
                </tr>
              ))}
              {payslips.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No payroll records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Documents */}
      {tab === 'Documents' && (
        <DocumentVault employeeId={emp.id} canVerify />
      )}

      {/* Tab: Attendance */}
      {tab === 'Attendance' && (
        <div className="card p-5">
          <p className="text-sm text-gray-500 mb-4">Attendance summary for {emp.name}</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{attendanceStats.present}</p>
              <p className="text-xs text-gray-500">Days Present</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{attendanceStats.absent}</p>
              <p className="text-xs text-gray-500">Days Absent</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{attendanceStats.late}</p>
              <p className="text-xs text-gray-500">Late Arrivals</p>
            </div>
          </div>
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="w-full text-left text-sm">
              <thead><tr>{['Date', 'Check In', 'Check Out', 'Hours', 'Status'].map(h => <th key={h} className="table-head">{h}</th>)}</tr></thead>
              <tbody>
                {attendance.slice(0, 10).map(row => (
                  <tr key={row.id || row.date} className="hover:bg-gray-50">
                    <td className="table-cell">{row.date}</td>
                    <td className="table-cell">{row.checkIn || '-'}</td>
                    <td className="table-cell">{row.checkOut || '-'}</td>
                    <td className="table-cell">{row.hours || 0}</td>
                    <td className="table-cell"><span className={row.status === 'Present' ? 'badge-green' : row.status === 'Late' ? 'badge-yellow' : 'badge-red'}>{row.status}</span></td>
                  </tr>
                ))}
                {attendance.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400 text-sm">No attendance records</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit — ${emp.name}`} size="lg">
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" value={editForm.name} onChange={e => setEF('name', e.target.value)} />
              </div>
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" value={editForm.email} onChange={e => setEF('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editForm.phone} onChange={e => setEF('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Department *</label>
                <select className="select" value={editForm.dept} onChange={e => setEF('dept', e.target.value)}>
                  <option value="">Select dept</option>
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Job Title *</label>
                <input className="input" value={editForm.role} onChange={e => setEF('role', e.target.value)} />
              </div>
              <div>
                <label className="label">Manager</label>
                <select className="select" value={editForm.manager || ''} onChange={e => setEF('manager', e.target.value)}>
                  <option value="">No manager</option>
                  {activeManagers.map(manager => <option key={manager.id} value={manager.name}>{manager.name} - {manager.role}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={editForm.status} onChange={e => setEF('status', e.target.value)}>
                  <option>Active</option>
                  <option>On Leave</option>
                  <option>Inactive</option>
                </select>
              </div>
              <div>
                <label className="label">Monthly Salary (LKR)</label>
                <input className="input" type="number" value={editForm.salary} onChange={e => setEF('salary', e.target.value)} />
              </div>
              <div>
                <label className="label">Leave Balance (days)</label>
                <input className="input" type="number" value={editForm.leaveBalance} onChange={e => setEF('leaveBalance', parseInt(e.target.value, 10) || 0)} />
              </div>
              <div>
                <label className="label">Join Date</label>
                <input className="input" type="date" value={editForm.joined} onChange={e => setEF('joined', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button className="btn-primary flex-1" onClick={handleSaveEdit}>
                <Save className="w-4 h-4" /> Save Changes
              </button>
              <button className="btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete / Deactivate Employee" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">
              This will deactivate <strong>{emp.name}</strong>, set their employee record to inactive, and block portal login.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn-danger flex-1" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" /> Deactivate and Block Login
            </button>
            <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={handlePermanentDelete}>
              Delete Permanently
            </button>
            <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
