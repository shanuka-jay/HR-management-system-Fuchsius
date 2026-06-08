import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader'
import Modal from '../../../components/shared/Modal'
import { useHR } from '../../../context/HRContext'
import { Plus, Search, Download, Edit2, Trash2, AlertTriangle } from 'lucide-react'
import { exportRowsAsCsv } from '../../../components/shared/exportUtils'
import { formatCurrency } from '../../../utils/currency'

const DEPTS = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']

function EditEmployeeModal({ emp, employees, onSave, onClose }) {
  const [form, setForm] = useState({
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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const activeManagers = employees.filter(e => e.status === 'Active' && e.id !== emp.id)

  const handleSave = () => {
    if (!form.name || !form.email || !form.dept || !form.role) {
      alert('Name, email, department and role are required.')
      return
    }
    onSave(form)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Full Name *</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Department *</label>
          <select className="select" value={form.dept} onChange={e => set('dept', e.target.value)}>
            <option value="">Select dept</option>
            {DEPTS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Job Title *</label>
          <input className="input" value={form.role} onChange={e => set('role', e.target.value)} />
        </div>
        <div>
          <label className="label">Manager</label>
          <select className="select" value={form.manager || ''} onChange={e => set('manager', e.target.value)}>
            <option value="">No manager</option>
            {activeManagers.map(manager => <option key={manager.id} value={manager.name}>{manager.name} - {manager.role}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="select" value={form.status} onChange={e => set('status', e.target.value)}>
            <option>Active</option>
            <option>On Leave</option>
            <option>Inactive</option>
          </select>
        </div>
        <div>
          <label className="label">Monthly Salary (LKR)</label>
          <input className="input" type="number" value={form.salary} onChange={e => set('salary', parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <label className="label">Leave Balance (days)</label>
          <input className="input" type="number" value={form.leaveBalance} onChange={e => set('leaveBalance', parseInt(e.target.value, 10) || 0)} />
        </div>
        <div>
          <label className="label">Join Date</label>
          <input className="input" type="date" value={form.joined} onChange={e => set('joined', e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button className="btn-primary flex-1" onClick={handleSave}>Save Changes</button>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export default function HREmployeeList() {
  const navigate = useNavigate()
  const { employees, editEmployee, deleteEmployee, permanentlyDeleteEmployee } = useHR()

  const [search, setSearch]         = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editEmp, setEditEmp]       = useState(null)  // employee being edited
  const [deleteEmp, setDeleteEmp]   = useState(null)  // employee being deleted

  const depts = [...new Set(employees.map(e => e.dept))]

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
                        e.id.toLowerCase().includes(search.toLowerCase())
    const matchDept   = !deptFilter   || e.dept   === deptFilter
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchDept && matchStatus
  })

  const handleSaveEdit = (data) => {
    editEmployee(editEmp.id, data)
    setEditEmp(null)
  }

  const handleConfirmDelete = () => {
    deleteEmployee(deleteEmp.id)
    setDeleteEmp(null)
  }

  const handlePermanentDelete = async () => {
    const confirmed = await window.fuchsiusConfirm(`Permanently delete ${deleteEmp.name} and all linked HR records? This cannot be undone.`, {
      title: 'Permanently Delete Employee',
      confirmLabel: 'Delete Permanently',
    })
    if (!confirmed) return
    await permanentlyDeleteEmployee(deleteEmp.id)
    setDeleteEmp(null)
  }
  const exportEmployees = () => exportRowsAsCsv('fuchsius-hrms-employees.csv', filtered.map(e => ({
    ID: e.id,
    Employee: e.name,
    Email: e.email,
    Department: e.dept,
    Role: e.role,
    Manager: e.manager,
    Status: e.status,
    'Monthly Salary': e.salary,
  })))

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total employees`}
        actions={
          <>
            <button className="btn-secondary text-xs" onClick={exportEmployees}><Download className="w-3.5 h-3.5" /> Export</button>
            <Link to="/hr/employees/add" className="btn-primary">
              <Plus className="w-4 h-4" /> Add Employee
            </Link>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select w-40 text-sm" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="select w-36 text-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>On Leave</option>
          <option>Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr>
              {['Employee', 'ID', 'Department', 'Role', 'Manager', 'Status', 'Monthly Salary', 'Actions'].map(h => (
                <th key={h} className="table-head">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr
                key={emp.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/hr/employees/${emp.id}`)}
              >
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-gray-600">{emp.name.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell font-mono text-xs text-gray-500">{emp.id}</td>
                <td className="table-cell">{emp.dept}</td>
                <td className="table-cell text-gray-500 text-xs">{emp.role}</td>
                <td className="table-cell text-gray-500 text-xs">{emp.manager}</td>
                <td className="table-cell">
                  <span className={
                    emp.status === 'Active'   ? 'badge-green' :
                    emp.status === 'On Leave' ? 'badge-yellow' : 'badge-red'
                  }>{emp.status}</span>
                </td>
                <td className="table-cell font-medium">{formatCurrency(emp.salary)}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => navigate(`/hr/employees/${emp.id}`)}
                    >View</button>
                    <button
                      className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-blue-600 rounded-lg hover:bg-blue-50 transition font-medium"
                      onClick={() => setEditEmp(emp)}
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    {emp.status === 'Inactive' ? (
                      <span className="px-2 py-1.5 text-xs font-medium text-gray-400">Access removed</span>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-red-600 rounded-lg hover:bg-red-50 transition font-medium"
                        onClick={() => setDeleteEmp(emp)}
                        title="Delete/deactivate employee and block login access"
                      >
                        <Trash2 className="w-3 h-3" /> Delete / Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No employees found matching your search.</div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editEmp}
        onClose={() => setEditEmp(null)}
        title={editEmp ? `Edit — ${editEmp.name}` : ''}
        size="lg"
      >
        {editEmp && (
          <EditEmployeeModal
            emp={editEmp}
            employees={employees}
            onSave={handleSaveEdit}
            onClose={() => setEditEmp(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteEmp}
        onClose={() => setDeleteEmp(null)}
        title="Delete / Deactivate Employee"
        size="sm"
      >
        {deleteEmp && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                This will deactivate <strong>{deleteEmp.name}</strong>, set their employee record to inactive, and block portal login.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-gray-500">Employee ID: <span className="font-mono font-medium text-gray-800">{deleteEmp.id}</span></p>
              <p className="text-gray-500 mt-1">Department: <span className="font-medium text-gray-800">{deleteEmp.dept}</span></p>
              <p className="text-gray-500 mt-1">Login access: <span className="font-medium text-red-600">Will be blocked</span></p>
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-danger flex-1" onClick={handleConfirmDelete}>
                <Trash2 className="w-4 h-4" /> Deactivate and Block Login
              </button>
              <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={handlePermanentDelete}>
                Delete Permanently
              </button>
              <button className="btn-secondary" onClick={() => setDeleteEmp(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
