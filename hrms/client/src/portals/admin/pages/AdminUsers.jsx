import React, { useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { CheckCircle, Edit2, Eye, Loader2, Plus, Shield, Trash2, UserX } from 'lucide-react'
import { employeesApi, usersApi } from '../../../api/services'

const roleBadge = {
  admin: 'badge-black',
  hr: 'badge-blue',
  manager: 'badge-gray',
  employee: 'badge-gray',
}

const roleLabel = {
  admin: 'Super Admin',
  hr: 'HR Manager',
  manager: 'Team Manager',
  employee: 'Employee',
}

const DEPTS = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']
const freshForm = () => ({
  name: '',
  email: '',
  password: '',
  role: 'manager',
  dept: 'Engineering',
  title: '',
  phone: '',
  manager: '',
  salary: '',
  joinDate: new Date().toISOString().slice(0, 10),
  employmentType: 'Full-time',
  leaveBalance: 14,
})

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [viewUser, setViewUser] = useState(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [managerOptions, setManagerOptions] = useState([])
  const [form, setForm] = useState(freshForm)
  const setF = (key, value) => setForm(current => ({ ...current, [key]: value }))

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await usersApi.list()
      setUsers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    employeesApi.managers().then(res => setManagerOptions(res.data || [])).catch(() => setManagerOptions([]))
  }, [])

  const openAdd = () => {
    setEditUser(null)
    setForm(freshForm())
    setShowModal(true)
  }

  const openEdit = (user) => {
    setEditUser(user)
    setForm({
      ...freshForm(),
      name: user.name,
      email: user.email,
      role: user.role,
      dept: user.dept || 'Engineering',
      title: user.title || '',
      manager: user.employee?.manager || '',
      salary: user.employee?.salary || '',
      joinDate: user.employee?.joined || new Date().toISOString().slice(0, 10),
      employmentType: user.employee?.employmentType || 'Full-time',
      leaveBalance: user.employee?.leaveBalance || 14,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    if (!editUser && (!form.password || !form.title || !form.joinDate)) {
      alert('Password, job title and join date are required for new privileged users.')
      return
    }
    setSaving(true)
    try {
      if (editUser) {
        const { phone, manager, salary, joinDate, employmentType, leaveBalance, ...updates } = form
        if (!updates.password) delete updates.password
        await usersApi.update(editUser.id, updates)
        setSuccess('User updated.')
      } else {
        await usersApi.create(form)
        setSuccess('User and linked employee profile created.')
      }
      setShowModal(false)
      await loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save user')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (user) => {
    const confirmed = await window.fuchsiusConfirm(`Deactivate ${user.name}? Their linked employee profile will also become inactive.`, {
      title: 'Deactivate User',
      confirmLabel: 'Deactivate',
    })
    if (!confirmed) return
    try {
      await usersApi.delete(user.id)
      setSuccess(`${user.name} deactivated.`)
      await loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to deactivate user')
    }
  }

  const handlePermanentDelete = async (user) => {
    const confirmed = await window.fuchsiusConfirm(`Permanently delete ${user.name}'s login account? The employee record stays inactive for HR history.`, {
      title: 'Permanently Delete User',
      confirmLabel: 'Delete User',
    })
    if (!confirmed) return
    try {
      await usersApi.deletePermanent(user.id)
      setSuccess(`${user.name} permanently deleted.`)
      await loadUsers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user')
    }
  }

  const formatLastLogin = (raw) => {
    if (!raw) return 'Never'
    const date = new Date(raw)
    const diff = Date.now() - date.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`
    return date.toLocaleDateString()
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Admin creates HR, team manager and admin accounts with linked employee profiles."
        actions={
          <button className="btn-primary" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add User
          </button>
        }
      />

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 mb-4 text-sm">
          <CheckCircle className="w-4 h-4" />{success}
        </div>
      )}

      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Access Permission Matrix
        </h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-2 font-semibold">Module</th>
                {['Super Admin', 'HR Manager', 'Team Manager', 'Employee'].map(role => (
                  <th key={role} className="pb-2 font-semibold text-center">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Employee Management', 'Yes', 'Yes', 'View', 'Self'],
                ['Payroll', 'Yes', 'Yes', '-', 'View'],
                ['Leave Management', 'Yes', 'Yes', 'Approve', 'Apply'],
                ['Attendance', 'Yes', 'Yes', 'Team', 'Self'],
                ['Recruitment', 'Yes', 'Yes', '-', '-'],
                ['Performance', 'Yes', 'Yes', 'Team', 'Self'],
                ['System Settings', 'Yes', '-', '-', '-'],
                ['Reports', 'Yes', 'Yes', 'Team', '-'],
              ].map(([module, ...perms]) => (
                <tr key={module} className="border-t border-gray-100">
                  <td className="py-2 pr-4 font-medium text-gray-700">{module}</td>
                  {perms.map((perm, index) => (
                    <td key={index} className={`py-2 text-center ${perm === 'Yes' ? 'text-emerald-600 font-bold' : perm === '-' ? 'text-gray-300' : 'text-gray-600'}`}>
                      {perm}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading users...
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr>
                {['User', 'Email', 'Role', 'Employee', 'Status', 'Last Login', 'Actions'].map(heading => (
                  <th key={heading} className="table-head">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-gray-600">{user.name.charAt(0)}</span>
                      </div>
                      <span className="font-medium text-gray-800 text-sm">{user.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500">{user.email}</td>
                  <td className="table-cell"><span className={roleBadge[user.role] || 'badge-gray'}>{roleLabel[user.role] || user.role}</span></td>
                  <td className="table-cell text-xs text-gray-500">{user.employee?.id || 'Not linked'}</td>
                  <td className="table-cell"><span className={user.status === 'Active' ? 'badge-green' : 'badge-red'}>{user.status}</span></td>
                  <td className="table-cell text-gray-400 text-xs">{formatLastLogin(user.lastLogin)}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button className="btn-ghost p-1" onClick={() => setViewUser(user)} title="View details"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="btn-ghost p-1" onClick={() => openEdit(user)} title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="btn-ghost p-1 text-red-400 hover:text-red-600" onClick={() => handleDeactivate(user)} title="Deactivate" disabled={user.status === 'Inactive'}>
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                      <button className="btn-ghost p-1 text-red-500 hover:text-red-700" onClick={() => handlePermanentDelete(user)} title="Permanently delete user">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Edit User' : 'Add Privileged User'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={event => setF('name', event.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={event => setF('email', event.target.value)} placeholder="jane@fuchsius.lk" />
            </div>
            <div>
              <label className="label">{editUser ? 'New Temporary Password' : 'Password'}</label>
              <input className="input" type="password" value={form.password} onChange={event => setF('password', event.target.value)} placeholder={editUser ? 'Leave blank to keep current' : 'At least 8 characters'} />
              {editUser && <p className="text-xs text-gray-400 mt-1">Use this when a newly created user cannot log in or forgot the temporary password.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">System Role</label>
              <select className="select" value={form.role} onChange={event => setF('role', event.target.value)}>
                {editUser && <option value="employee">Employee</option>}
                <option value="manager">Team Manager</option>
                <option value="hr">HR Manager</option>
                <option value="admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Department</label>
              <select className="select" value={form.dept} onChange={event => setF('dept', event.target.value)}>
                {DEPTS.map(dept => <option key={dept}>{dept}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Job Title</label>
            <input className="input" value={form.title} onChange={event => setF('title', event.target.value)} placeholder="e.g. HR Manager" />
          </div>

          {!editUser && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Reporting Manager</label>
                  <select className="select" value={form.manager} onChange={event => setF('manager', event.target.value)}>
                    <option value="">No manager</option>
                    {managerOptions.map(manager => <option key={manager.id} value={manager.name}>{manager.name} - {manager.role}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Join Date</label>
                  <input className="input" type="date" value={form.joinDate} onChange={event => setF('joinDate', event.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={event => setF('phone', event.target.value)} placeholder="+1-555-0000" />
                </div>
                <div>
                  <label className="label">Monthly Salary (LKR)</label>
                  <input className="input" type="number" value={form.salary} onChange={event => setF('salary', event.target.value)} placeholder="250000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Employment Type</label>
                  <select className="select" value={form.employmentType} onChange={event => setF('employmentType', event.target.value)}>
                    {['Full-time', 'Part-time', 'Contract', 'Intern'].map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Leave Balance</label>
                  <input className="input" type="number" value={form.leaveBalance} onChange={event => setF('leaveBalance', event.target.value)} />
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                This creates both a login account and a linked employee profile, so the user appears in HR Employees and can use My Workspace after login.
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editUser ? 'Update User' : 'Create User + Employee'}
            </button>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="User Details" size="sm">
        {viewUser && (
          <div className="space-y-3 text-sm">
            {[
              ['Name', viewUser.name],
              ['Email', viewUser.email],
              ['System Role', roleLabel[viewUser.role] || viewUser.role],
              ['Department', viewUser.dept || '-'],
              ['Job Title', viewUser.title || '-'],
              ['Status', viewUser.status],
              ['Linked Employee', viewUser.employee?.id || 'Not linked'],
              ['Employee Status', viewUser.employee?.status || '-'],
              ['Manager', viewUser.employee?.manager || '-'],
              ['Joined', viewUser.employee?.joined || '-'],
              ['Last Login', formatLastLogin(viewUser.lastLogin)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800 text-right">{value}</span>
              </div>
            ))}
            <button className="btn-secondary w-full mt-2" onClick={() => setViewUser(null)}>Close</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
