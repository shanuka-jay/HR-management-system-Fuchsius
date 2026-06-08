import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Upload, CheckCircle, Trash2, X, Mail, Copy } from 'lucide-react'
import { useHR } from '../../../context/HRContext'
import { employeesApi } from '../../../api/services'
import { formatCurrency } from '../../../utils/currency'

const DEPTS = ['Engineering', 'Human Resources', 'IT', 'Customer Success', 'Marketing', 'Finance', 'Design', 'Sales']
export default function HRAddEmployee() {
  const navigate = useNavigate()
  const { addEmployee, addEmployeeDocument } = useHR()
  const fileInputRef = useRef(null)
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const [newId, setNewId] = useState('')
  const [emailDelivery, setEmailDelivery] = useState(null)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState({})
  const [pendingDocs, setPendingDocs] = useState([])
  const [managerOptions, setManagerOptions] = useState([])

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dept: '', role: '',
    systemRole: 'employee', manager: '', salary: '', joinDate: '', employmentType: 'Full-time',
    address: '', emergencyName: '', emergencyPhone: '', emergencyRel: '',
    password: '', confirmPassword: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const steps = ['Personal Info', 'Employment', 'Emergency Contact', 'Review']

  useEffect(() => {
    employeesApi.managers()
      .then(res => setManagerOptions(res.data || []))
      .catch(() => setManagerOptions([]))
  }, [])

  const validate = (stepNum) => {
    const e = {}
    if (stepNum === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required'
      if (!form.lastName.trim())  e.lastName  = 'Required'
      if (!form.email.trim())     e.email     = 'Required'
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    }
    if (stepNum === 2) {
      if (!form.dept)            e.dept     = 'Required'
      if (!form.role.trim())     e.role     = 'Required'
      if (!form.joinDate)        e.joinDate = 'Required'
      if (!form.password)        e.password = 'Required'
      if (form.password && form.password.length < 8) e.password = 'Use at least 8 characters'
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match'
    }
    if (stepNum === 3) {
      if (!form.emergencyName.trim())  e.emergencyName  = 'Required'
      if (!form.emergencyPhone.trim()) e.emergencyPhone = 'Required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (validate(step)) setStep(s => s + 1)
  }

  const handleCreate = async () => {
    try {
      const created = await addEmployee(form)
      const id = created.id || created.employee?.id || created
      if (pendingDocs.length > 0) {
        for (const file of pendingDocs) {
          await addEmployeeDocument(id, file, 'Onboarding', 'HR')
        }
      }
      setNewId(id)
      setEmailDelivery(created.emailDelivery || null)
      setSaved(true)
    } catch (err) {
      alert('Failed to create employee: ' + (err.response?.data?.error || err.message))
    }
  }

  const addPendingDocs = (files) => {
    const selected = Array.from(files || [])
    setPendingDocs(prev => [...prev, ...selected])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingDoc = (index) => {
    setPendingDocs(prev => prev.filter((_, i) => i !== index))
  }

  const credentialsText = [
    'Welcome to Fuchsius HRMS',
    `Login URL: ${window.location.origin}/login`,
    `Email: ${form.email}`,
    `Temporary password: ${form.password}`,
    'Access: Employee Portal',
    'Please sign in and change your password from your profile.',
  ].join('\n')

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(credentialsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (_) {
      alert(credentialsText)
    }
  }

  const openMailClient = () => {
    const subject = encodeURIComponent('Welcome to Fuchsius HRMS - employee portal login')
    const body = encodeURIComponent(credentialsText)
    window.location.href = `mailto:${form.email}?subject=${subject}&body=${body}`
  }

  if (saved) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Employee Created!</h2>
        <p className="text-sm text-gray-500 mb-1">
          <strong>{form.firstName} {form.lastName}</strong> has been added to the system.
        </p>
        <p className="text-xs text-gray-400">Employee ID: <span className="font-mono font-semibold text-gray-700">{newId}</span></p>
        <p className="text-xs text-gray-500 mb-6">
          Login is ready for <span className="font-mono font-semibold text-gray-700">{form.email}</span> with employee access.
        </p>
        <div className={`rounded-xl border p-4 text-left mb-5 ${
          emailDelivery?.sent
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <Mail className={`w-5 h-5 mt-0.5 ${emailDelivery?.sent ? 'text-emerald-600' : 'text-amber-600'}`} />
            <div>
              <p className={`text-sm font-semibold ${emailDelivery?.sent ? 'text-emerald-800' : 'text-amber-800'}`}>
                {emailDelivery?.sent ? 'Welcome email sent' : 'Welcome email saved for review'}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {emailDelivery?.message || 'SMTP is not configured. Use the actions below to share the login details.'}
              </p>
              {emailDelivery?.outboxPath && (
                <p className="text-[11px] text-gray-500 mt-2 break-all">Outbox: {emailDelivery.outboxPath}</p>
              )}
            </div>
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-left mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Credentials shared with employee</p>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">Login:</span> <span className="font-mono">{form.email}</span></p>
            <p><span className="text-gray-500">Temporary password:</span> <span className="font-mono">{form.password}</span></p>
            <p><span className="text-gray-500">Portal access:</span> <span className="font-medium">Employee Portal</span></p>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-secondary text-xs" onClick={copyCredentials}>
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn-secondary text-xs" onClick={openMailClient}>
              <Mail className="w-3.5 h-3.5" /> Open Email
            </button>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button className="btn-primary" onClick={() => navigate(`/hr/employees/${newId}`)}>
            View Profile
          </button>
          <button className="btn-secondary" onClick={() => navigate('/hr/employees/add')
            || window.location.reload()}>
            Add Another
          </button>
          <button className="btn-secondary" onClick={() => navigate('/hr/employees')}>
            Back to List
          </button>
        </div>
      </div>
    )
  }

  const err = (k) => errors[k] && <p className="text-xs text-red-500 mt-1">{errors[k]}</p>

  return (
    <div>
      <Link to="/hr/employees" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Employees
      </Link>

      <div className="mb-6">
        <h2 className="page-title">Add New Employee</h2>
        <p className="page-subtitle">Fill in the details to create a new employee profile</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex items-center gap-2" onClick={() => i + 1 < step && setStep(i + 1)}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i + 1 < step  ? 'bg-emerald-500 text-white cursor-pointer' :
                i + 1 === step ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{i + 1 < step ? '✓' : i + 1}</div>
              <span className={`text-xs font-medium hidden sm:block ${i + 1 <= step ? 'text-gray-900' : 'text-gray-400'}`}>{s}</span>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-px mx-2 ${i + 1 < step ? 'bg-emerald-500' : 'bg-gray-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <div className="card p-6 max-w-2xl">

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Personal Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input className="input" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="John" />
                {err('firstName')}
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input className="input" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Doe" />
                {err('lastName')}
              </div>
            </div>
            <div>
              <label className="label">Email Address *</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john.doe@fuchsius.lk" />
              {err('email')}
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1-555-0000" />
            </div>
            <div>
              <label className="label">Home Address</label>
              <input className="input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, City, State" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Employment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Department *</label>
                <select className="select" value={form.dept} onChange={e => set('dept', e.target.value)}>
                  <option value="">Select dept</option>
                  {DEPTS.map(d => <option key={d}>{d}</option>)}
                </select>
                {err('dept')}
              </div>
              <div>
                <label className="label">Employment Type</label>
                <select className="select" value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
                  {['Full-time', 'Part-time', 'Contract', 'Intern'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Job Title / Role *</label>
              <input className="input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Software Engineer" />
              {err('role')}
            </div>
            <div>
              <label className="label">Reporting Manager</label>
              <select className="select" value={form.manager} onChange={e => set('manager', e.target.value)}>
                <option value="">Select manager</option>
                {managerOptions.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name} - {emp.role} ({emp.dept})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Monthly Salary (LKR)</label>
                <input className="input" type="number" value={form.salary} onChange={e => set('salary', e.target.value)} placeholder="250000" />
              </div>
              <div>
                <label className="label">Join Date *</label>
                <input className="input" type="date" value={form.joinDate} onChange={e => set('joinDate', e.target.value)} />
                {err('joinDate')}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Initial Login Password *</label>
                <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="At least 8 characters" />
                {err('password')}
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input className="input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
                {err('confirmPassword')}
              </div>
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Upload documents (CV, ID, certificates)</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOC, JPG up to 10MB</p>
              <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => fileInputRef.current?.click()}>Choose Files</button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => addPendingDocs(e.target.files)}
              />
              {pendingDocs.length > 0 && (
                <div className="mt-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-600">{pendingDocs.length} document{pendingDocs.length === 1 ? '' : 's'} ready to attach</p>
                    <button type="button" className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1" onClick={() => setPendingDocs([])}>
                      <X className="w-3 h-3" /> Clear all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {pendingDocs.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                        <span className="truncate text-gray-700">{file.name}</span>
                        <button type="button" className="text-red-600 hover:text-red-700" onClick={() => removePendingDoc(index)} title="Remove file">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Emergency Contact</h3>
            <div>
              <label className="label">Contact Name *</label>
              <input className="input" value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} placeholder="Jane Doe" />
              {err('emergencyName')}
            </div>
            <div>
              <label className="label">Relationship</label>
              <input className="input" value={form.emergencyRel} onChange={e => set('emergencyRel', e.target.value)} placeholder="Spouse / Parent / Sibling" />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input className="input" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} placeholder="+1-555-0000" />
              {err('emergencyPhone')}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Review & Submit</h3>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              {[
                ['Full Name',       `${form.firstName} ${form.lastName}` || '—'],
                ['Email',           form.email    || '—'],
                ['Phone',           form.phone    || '—'],
                ['Department',      form.dept     || '—'],
                ['Role',            form.role     || '—'],
                ['System Access',   'Employee Portal'],
                ['Manager',         form.manager  || '—'],
                ['Monthly Salary',  form.salary   ? formatCurrency(form.salary) : '—'],
                ['Join Date',       form.joinDate || '—'],
                ['Login Email',      form.email    || '—'],
                ['Employment Type', form.employmentType],
                ['Emergency Contact', form.emergencyName || '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => step === 1 ? navigate('/hr/employees') : setStep(s => s - 1)}
            className="btn-secondary"
          >{step === 1 ? 'Cancel' : '← Back'}</button>
          <button
            onClick={() => step < 4 ? next() : handleCreate()}
            className="btn-primary"
          >{step === 4 ? <><Save className="w-4 h-4" /> Create Employee</> : 'Next →'}</button>
        </div>
      </div>
    </div>
  )
}
