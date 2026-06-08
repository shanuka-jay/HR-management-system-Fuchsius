import React, { useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader'
import { Save, Globe, Mail, Shield, Database, Bell, Send, Clock } from 'lucide-react'
import { auditLogsApi, notificationsApi, settingsApi } from '../../../api/services'
import { useHR } from '../../../context/HRContext'

const Section = ({ icon: Icon, title, children }) => (
  <div className="card p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-500" /> {title}
    </h3>
    <div className="space-y-4">{children}</div>
  </div>
)

const SettingNote = ({ active = false, children }) => (
  <p className={`text-[11px] mt-1 ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
    {active ? 'Active: ' : 'Saved only: '}{children}
  </p>
)

export default function AdminSettings() {
  const { fetchNotifications } = useHR()
  const [saved, setSaved] = useState(false)
  const [purged, setPurged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [systemStatus, setSystemStatus] = useState(null)
  const [settings, setSettings] = useState({
    company_name: 'Fuchsius',
    industry: 'Technology',
    headquarters: 'San Francisco, CA',
    financial_year_start: 'January',
    smtp_host: '',
    from_address: 'noreply@fuchsius.lk',
    leave_approval_emails: true,
    payroll_notifications: true,
    session_timeout_minutes: 60,
    password_min_length: 8,
    require_admin_2fa: false,
    auto_backup_frequency: 'Daily',
    data_retention_months: 84,
    attendance_shift1_name: 'Morning Shift',
    attendance_shift1_start: '09:00',
    attendance_shift1_end: '17:00',
    attendance_shift2_name: 'Evening Shift',
    attendance_shift2_start: '13:00',
    attendance_shift2_end: '21:00',
    attendance_grace_minutes: 5,
    attendance_completion_buffer_minutes: 15,
  })
  const [noticeSent, setNoticeSent] = useState(false)
  const [noticeForm, setNoticeForm] = useState({
    type: 'system',
    audience: 'admin,hr,manager,employee',
    dept: '',
    path: '/',
    msg: '',
  })
  const preserveScroll = (update) => {
    const container = document.querySelector('.content-main')
    const top = container ? container.scrollTop : window.scrollY
    update()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (container) container.scrollTop = top
        else window.scrollTo({ top })
      })
    })
  }
  const setNotice = (key, value) => preserveScroll(() => setNoticeForm(prev => ({ ...prev, [key]: value })))
  const setSetting = (key, value) => preserveScroll(() => setSettings(prev => ({ ...prev, [key]: value })))

  useEffect(() => {
    settingsApi.get().then(res => {
      const data = res.data || {}
      setSettings(prev => ({
        ...prev,
        ...data,
        leave_approval_emails: data.leave_approval_emails === undefined ? prev.leave_approval_emails : data.leave_approval_emails === 'true',
        payroll_notifications: data.payroll_notifications === undefined ? prev.payroll_notifications : data.payroll_notifications === 'true',
        require_admin_2fa: data.require_admin_2fa === undefined ? prev.require_admin_2fa : data.require_admin_2fa === 'true',
      }))
    }).catch(() => {})
    settingsApi.status().then(res => setSystemStatus(res.data || null)).catch(() => setSystemStatus(null))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsApi.update(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }
  const downloadBackup = () => {
    const payload = {
      app: 'Fuchsius HRMS',
      exportedAt: new Date().toISOString(),
      modules: ['employees', 'leave', 'attendance', 'payroll', 'performance', 'documents', 'notifications'],
      settings,
      note: 'Backup manifest generated from current saved system settings.',
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'Fuchsius HRMS-backup-manifest.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  const purgeOldLogs = async () => {
    const confirmed = await window.fuchsiusConfirm(`Purge audit logs older than ${settings.data_retention_months} months?`, {
      title: 'Purge Audit Logs',
      confirmLabel: 'Purge Logs',
    })
    if (!confirmed) return
    try {
      const res = await auditLogsApi.purgeOld(settings.data_retention_months)
      setPurged(`Purged ${res.data.purged} log(s)`)
      setTimeout(() => setPurged(false), 2500)
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to purge logs')
    }
  }
  const sendNotification = async () => {
    if (!noticeForm.msg.trim()) return
    await notificationsApi.create({ ...noticeForm, dept: noticeForm.dept || null })
    await fetchNotifications()
    setNoticeSent(true)
    setNoticeForm(f => ({ ...f, msg: '' }))
    setTimeout(() => setNoticeSent(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        subtitle="Configure global system preferences"
        actions={
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4" /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-400">Google SSO</p>
          <p className={`text-sm font-bold ${systemStatus?.googleSsoConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {systemStatus?.googleSsoConfigured ? 'Configured' : 'Needs GOOGLE_CLIENT_ID'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400">Email Delivery</p>
          <p className={`text-sm font-bold ${systemStatus?.smtpConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
            {systemStatus?.smtpConfigured ? 'SMTP enabled' : 'Outbox mode'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400">App URL</p>
          <p className="text-sm font-bold text-gray-800 truncate">{systemStatus?.appUrl || 'http://localhost:3000/login'}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section icon={Globe} title="Company Information">
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={settings.company_name} onChange={e => setSetting('company_name', e.target.value)} />
            <SettingNote active>Saved to global settings and reused by portal settings/export metadata.</SettingNote>
          </div>
          <div>
            <label className="label">Industry</label>
            <input className="input" value={settings.industry} onChange={e => setSetting('industry', e.target.value)} />
          </div>
          <div>
            <label className="label">Headquarters</label>
            <input className="input" value={settings.headquarters} onChange={e => setSetting('headquarters', e.target.value)} />
          </div>
          <div>
            <label className="label">Financial Year Start</label>
            <select className="select" value={settings.financial_year_start} onChange={e => setSetting('financial_year_start', e.target.value)}>
              <option>January</option><option>April</option><option>July</option><option>October</option>
            </select>
          </div>
        </Section>

        <Section icon={Mail} title="Email & Notifications">
          <div>
            <label className="label">SMTP Host</label>
            <input className="input" value={settings.smtp_host} onChange={e => setSetting('smtp_host', e.target.value)} />
            <SettingNote active={systemStatus?.smtpConfigured}>Real delivery uses server .env SMTP_HOST. Without it, emails are saved to server/outbox.</SettingNote>
          </div>
          <div>
            <label className="label">From Address</label>
            <input className="input" value={settings.from_address} onChange={e => setSetting('from_address', e.target.value)} />
            <SettingNote active={Boolean(systemStatus?.mailFrom)}>Real sender uses server .env MAIL_FROM / MAIL_FROM_ADDRESS.</SettingNote>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-700">Leave Approval Emails</p>
              <p className="text-xs text-gray-400">Notify employees on status change</p>
              <SettingNote>Leave notifications are portal notifications; email toggle is saved for future SMTP workflow.</SettingNote>
            </div>
            <button className={`w-10 h-6 rounded-full relative ${settings.leave_approval_emails ? 'bg-gray-900' : 'bg-gray-300'}`} onClick={() => setSetting('leave_approval_emails', !settings.leave_approval_emails)}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full ${settings.leave_approval_emails ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Payroll Notifications</p>
              <p className="text-xs text-gray-400">Alert on payslip generation</p>
              <SettingNote active>Payroll paid action creates portal notifications and payslip emails. Toggle is saved but not yet used to disable that workflow.</SettingNote>
            </div>
            <button className={`w-10 h-6 rounded-full relative ${settings.payroll_notifications ? 'bg-gray-900' : 'bg-gray-300'}`} onClick={() => setSetting('payroll_notifications', !settings.payroll_notifications)}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full ${settings.payroll_notifications ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </Section>

        <Section icon={Bell} title="Notification Composer">
          <div className="grid grid-cols-2 gap-3">
            <select className="select" value={noticeForm.type} onChange={e => setNotice('type', e.target.value)}>
              {['system', 'leave', 'payroll', 'attendance', 'document', 'employee', 'candidate', 'review'].map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="select" value={noticeForm.audience} onChange={e => setNotice('audience', e.target.value)}>
              <option value="admin,hr,manager,employee">All roles</option>
              <option value="admin,hr">Admin + HR</option>
              <option value="manager">Managers</option>
              <option value="employee">Employees</option>
              <option value="hr">HR only</option>
            </select>
            <input className="input" value={noticeForm.dept} onChange={e => setNotice('dept', e.target.value)} placeholder="Department target optional" />
            <input className="input" value={noticeForm.path} onChange={e => setNotice('path', e.target.value)} placeholder="/hr/dashboard" />
          </div>
          <textarea className="input" rows={3} value={noticeForm.msg} onChange={e => setNotice('msg', e.target.value)} placeholder="Announcement message" />
          <button className="btn-primary w-full" onClick={sendNotification}>
            <Send className="w-4 h-4" /> {noticeSent ? 'Sent' : 'Send Notification'}
          </button>
        </Section>

        <Section icon={Clock} title="Attendance & Shift Rules">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            These rules decide who is late and whether a checked-out employee completed their shift. Attendance reports use the same rules.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Shift 1 Name</label>
              <input className="input" value={settings.attendance_shift1_name} onChange={e => setSetting('attendance_shift1_name', e.target.value)} />
              <SettingNote active>Used by attendance check-in, checkout, HR table, employee table, manager table, and reports.</SettingNote>
            </div>
            <div>
              <label className="label">Shift 1 Start</label>
              <input className="input" type="time" value={settings.attendance_shift1_start} onChange={e => setSetting('attendance_shift1_start', e.target.value)} />
            </div>
            <div>
              <label className="label">Shift 1 End</label>
              <input className="input" type="time" value={settings.attendance_shift1_end} onChange={e => setSetting('attendance_shift1_end', e.target.value)} />
            </div>
            <div>
              <label className="label">Shift 2 Name</label>
              <input className="input" value={settings.attendance_shift2_name} onChange={e => setSetting('attendance_shift2_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Shift 2 Start</label>
              <input className="input" type="time" value={settings.attendance_shift2_start} onChange={e => setSetting('attendance_shift2_start', e.target.value)} />
            </div>
            <div>
              <label className="label">Shift 2 End</label>
              <input className="input" type="time" value={settings.attendance_shift2_end} onChange={e => setSetting('attendance_shift2_end', e.target.value)} />
            </div>
            <div>
              <label className="label">Late Grace Minutes</label>
              <input className="input" type="number" min="0" value={settings.attendance_grace_minutes} onChange={e => setSetting('attendance_grace_minutes', e.target.value)} />
            </div>
            <div>
              <label className="label">Completion Buffer Minutes</label>
              <input className="input" type="number" min="0" value={settings.attendance_completion_buffer_minutes} onChange={e => setSetting('attendance_completion_buffer_minutes', e.target.value)} />
            </div>
          </div>
        </Section>

        <Section icon={Shield} title="Security">
          <div>
            <label className="label">Session Timeout (minutes)</label>
            <input className="input" type="number" value={settings.session_timeout_minutes} onChange={e => setSetting('session_timeout_minutes', e.target.value)} />
            <SettingNote>Saved, but automatic logout by timeout is not implemented yet.</SettingNote>
          </div>
          <div>
            <label className="label">Password Min Length</label>
            <input className="input" type="number" value={settings.password_min_length} onChange={e => setSetting('password_min_length', e.target.value)} />
            <SettingNote active>Used when creating users/employees/candidates and changing passwords.</SettingNote>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Two-Factor Authentication</p>
              <p className="text-xs text-gray-400">Require 2FA for all admin accounts</p>
              <SettingNote>Saved, but 2FA login enforcement is not implemented.</SettingNote>
            </div>
            <button className={`w-10 h-6 rounded-full relative ${settings.require_admin_2fa ? 'bg-gray-900' : 'bg-gray-300'}`} onClick={() => setSetting('require_admin_2fa', !settings.require_admin_2fa)}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full ${settings.require_admin_2fa ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </Section>

        <Section icon={Database} title="Data & Backup">
          <div>
            <label className="label">Auto Backup Frequency</label>
            <select className="select" value={settings.auto_backup_frequency} onChange={e => setSetting('auto_backup_frequency', e.target.value)}>
              <option>Daily</option><option>Weekly</option><option>Monthly</option>
            </select>
            <SettingNote>Saved in backup manifest; scheduled automatic backup is not implemented.</SettingNote>
          </div>
          <div>
            <label className="label">Data Retention (months)</label>
            <input className="input" type="number" value={settings.data_retention_months} onChange={e => setSetting('data_retention_months', e.target.value)} />
            <SettingNote active>Used by the Purge Old Logs action.</SettingNote>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1 text-xs" onClick={downloadBackup}>Download Backup</button>
            <button className="btn-secondary flex-1 text-xs text-red-600 hover:bg-red-50" onClick={purgeOldLogs}>
              {purged || 'Purge Old Logs'}
            </button>
          </div>
        </Section>
      </div>
    </div>
  )
}
