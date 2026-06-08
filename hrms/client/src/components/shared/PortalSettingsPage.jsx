import React, { useState, useEffect } from 'react'
import { Bell, Lock, Save, SlidersHorizontal, Loader2, CheckCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { settingsApi } from '../../api/services'

export default function PortalSettingsPage() {
  const { user } = useAuth()
  const prefKey = `fuchsius:prefs:${user?.id || user?.role || 'guest'}`
  const [prefs, setPrefs]         = useState(() => {
    try {
      const saved = localStorage.getItem(prefKey)
      return saved ? JSON.parse(saved) : { emailAlerts: true, workflowAlerts: true, compactTables: false, requireApprovalNotes: true }
    } catch {
      return { emailAlerts: true, workflowAlerts: true, compactTables: false, requireApprovalNotes: true }
    }
  })
  const [company, setCompany]     = useState({ company_name: '', company_email: '', company_phone: '', timezone: 'Asia/Colombo', currency: 'LKR', work_hours_per_day: '8' })
  const [loading, setLoading]     = useState(true)
  const [saving,  setSaving]      = useState(false)
  const [saved,   setSaved]       = useState(false)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      settingsApi.get().then(res => {
        const s = res.data
        setCompany({
          company_name:       s.company_name       || '',
          company_email:      s.company_email      || '',
          company_phone:      s.company_phone      || '',
          timezone:           s.timezone           || 'Asia/Colombo',
          currency:           s.currency           || 'LKR',
          work_hours_per_day: s.work_hours_per_day || '8',
        })
      }).catch(console.error).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAdmin])

  const toggle = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }))

  const handleSave = async () => {
    setSaving(true)
    try {
      if (isAdmin) {
        await settingsApi.update(company)
      }
      localStorage.setItem(prefKey, JSON.stringify(prefs))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Failed to save settings: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="card p-6">
        <p className="page-kicker capitalize">{user?.role} Portal</p>
        <h2 className="text-2xl font-black text-gray-950">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Control notifications, approvals and display preferences for this portal.</p>
      </div>

      {/* Company Settings — Admin only */}
      {isAdmin && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Company Information</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ['company_name',       'Company Name',        'text'],
                ['company_email',      'Company Email',       'email'],
                ['company_phone',      'Company Phone',       'text'],
                ['timezone',           'Timezone',            'text'],
                ['currency',           'Currency',            'text'],
                ['work_hours_per_day', 'Work Hours / Day',    'number'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    className="input"
                    type={type}
                    value={company[key]}
                    onChange={e => setCompany(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notification prefs */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" /> Notification Workflow
        </h3>
        {[
          ['emailAlerts',    'Email alerts',            'Send important leave, payroll, review and document events to email.'],
          ['workflowAlerts', 'In-app workflow alerts',  'Show role-based notifications in the header bell across all pages.'],
        ].map(([key, title, description]) => (
          <label key={key} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
            <span>
              <span className="block text-sm font-medium text-gray-800">{title}</span>
              <span className="block text-xs text-gray-500">{description}</span>
            </span>
            <input type="checkbox" checked={prefs[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-gray-950" />
          </label>
        ))}
      </div>

      {/* Workspace prefs */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" /> Workspace Preferences
        </h3>
        {[
          ['compactTables',        'Compact tables',   'Use tighter row spacing on employee, report and approval tables.'],
          ['requireApprovalNotes', 'Approval notes',   'Ask reviewers to add a note when rejecting leave or documents.'],
        ].map(([key, title, description]) => (
          <label key={key} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
            <span>
              <span className="block text-sm font-medium text-gray-800">{title}</span>
              <span className="block text-xs text-gray-500">{description}</span>
            </span>
            <input type="checkbox" checked={prefs[key]} onChange={() => toggle(key)} className="w-4 h-4 accent-gray-950" />
          </label>
        ))}
      </div>

      {/* Save */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-gray-500" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Security</p>
            <p className="text-xs text-gray-500">Session sign out is available from the avatar menu in the header.</p>
            <p className="text-xs text-gray-400 mt-1">Personal workspace preferences are saved on this browser.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="flex items-center gap-1 text-emerald-600 text-sm"><CheckCircle className="w-4 h-4" /> Saved!</span>}
          <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
