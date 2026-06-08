import React, { useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import Table from '../../../components/shared/Table'
import Modal from '../../../components/shared/Modal'
import { departmentsApi } from '../../../api/services'
import { Plus, Building2 } from 'lucide-react'

export default function AdminOrganization() {
  const [showModal, setShowModal] = useState(false)
  const [editDept, setEditDept] = useState(null)
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState({ name: '', head: '', budget: '' })

  const loadDepartments = () =>
    departmentsApi
      .list()
      .then(res => setDepartments(res.data || []))
      .catch(() => {})

  useEffect(() => {
    loadDepartments()
  }, [])

  const openCreate = () => {
    setEditDept(null)
    setForm({ name: '', head: '', budget: '' })
    setShowModal(true)
  }

  const openEdit = (dept) => {
    setEditDept(dept)
    setForm({
      name: dept.name || '',
      head: dept.head || '',
      budget: dept.budget || '',
    })
    setShowModal(true)
  }

  const saveDepartment = async () => {
    if (!form.name.trim()) {
      alert('Department name is required.')
      return
    }

    if (editDept) {
      await departmentsApi.update(editDept.id, form)
    } else {
      await departmentsApi.create(form)
    }

    await loadDepartments()
    setShowModal(false)
    setEditDept(null)
  }

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      maximumFractionDigits: 0,
    }).format(Number(value || 0))

  const columns = [
    {
      key: 'name',
      label: 'Department',
      render: r => (
        <div>
          <p className="font-medium text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-500">Department</p>
        </div>
      ),
    },
    {
      key: 'head',
      label: 'Department Head',
      render: r => r.head || <span className="text-gray-400">Not assigned</span>,
    },
    {
      key: 'employees',
      label: 'Headcount',
      width: 110,
      render: r => (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {r.employees || 0} staff
        </span>
      ),
    },
    {
      key: 'budget',
      label: 'Budget',
      render: r => formatCurrency(r.budget),
    },
    {
      key: 'actions',
      label: '',
      width: 90,
      render: r => (
        <button className="btn-ghost text-xs" onClick={() => openEdit(r)}>
          Edit
        </button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Organization"
        subtitle="Manage departments, heads, headcount, and budgets"
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add Department
          </button>
        }
      />

      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Organization Chart
        </h3>

        <div className="flex flex-col items-center">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-lg text-sm font-semibold mb-4">
            Fuchsius
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 w-full">
            {departments.map(d => (
              <div key={d.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-gray-800 truncate">{d.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {d.head || 'No head assigned'}
                </p>
                <p className="text-xs text-gray-400 mt-1">{d.employees || 0} staff</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Table columns={columns} data={departments} />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editDept ? 'Edit Department' : 'Add Department'}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Department Name</label>
            <input
              className="input"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Engineering"
            />
          </div>

          <div>
            <label className="label">Department Head</label>
            <input
              className="input"
              value={form.head}
              onChange={e => setForm({ ...form, head: e.target.value })}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="label">Annual Budget (LKR)</label>
            <input
              className="input"
              type="number"
              value={form.budget}
              onChange={e => setForm({ ...form, budget: e.target.value })}
              placeholder="e.g. 500000"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1" onClick={saveDepartment}>
              {editDept ? 'Save Department' : 'Create Department'}
            </button>
            <button className="btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}