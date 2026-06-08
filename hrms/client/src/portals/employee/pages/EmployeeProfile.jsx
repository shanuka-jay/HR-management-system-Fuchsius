import React, { useEffect, useState } from 'react'
import { Building2, Edit2, KeyRound, Mail, Phone, Save, User, Loader2 } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useHR } from '../../../context/HRContext'
import { employeesApi } from '../../../api/services'
import AvatarUploader from '../../../components/shared/AvatarUploader'
import DocumentVault from '../../../components/shared/DocumentVault'
import useCurrentEmployee from '../../../hooks/useCurrentEmployee'

export default function EmployeeProfile() {
  const { user, updateUserProfile, changePassword } = useAuth()
  const { editEmployee, fetchEmployees } = useHR()
  const { employee, loading, isLinked } = useCurrentEmployee()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    dept: '',
    role: '',
    manager: '',
    joined: '',
    address: '',
    emergencyName: '',
    emergencyRel: '',
    emergencyPhone: '',
    avatar: user?.avatar || null,
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMsg, setPasswordMsg] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!employee) return
    setForm({
      name: employee.name || '',
      email: employee.email || user?.email || '',
      phone: employee.phone || '',
      dept: employee.dept || '',
      role: employee.role || '',
      manager: employee.manager || '',
      joined: employee.joined || '',
      address: employee.address || '',
      emergencyName: employee.emergencyName || '',
      emergencyRel: employee.emergencyRel || '',
      emergencyPhone: employee.emergencyPhone || '',
      avatar: employee.avatar || user?.avatar || null,
    })
  }, [employee, user?.email, user?.avatar])

  const save = async () => {
    setProfileMsg('')
    if (!employee?.id) return
    try {
      await editEmployee(employee.id, {
        name: form.name,
        phone: form.phone,
        address: form.address,
        emergencyName: form.emergencyName,
        emergencyRel: form.emergencyRel,
        emergencyPhone: form.emergencyPhone,
      })
      await updateUserProfile({
        name: form.name,
        title: form.role,
        dept: form.dept,
        avatar: form.avatar,
      })
      await fetchEmployees()
      setEditing(false)
      setProfileMsg('Profile updated successfully.')
    } catch (err) {
      setProfileMsg(err.response?.data?.error || err.message || 'Failed to save profile.')
    }
  }

  const uploadAvatar = async (file) => {
    if (!employee?.id) return
    setAvatarLoading(true)
    setProfileMsg('')
    try {
      const res = await employeesApi.uploadAvatar(employee.id, file)
      const avatar = res.data.avatar
      set('avatar', avatar)
      await updateUserProfile({ name: form.name, title: form.role, dept: form.dept, avatar })
      await fetchEmployees()
      setProfileMsg('Profile picture updated.')
    } catch (err) {
      setProfileMsg(err.response?.data?.error || err.message || 'Failed to upload profile picture.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const removeAvatar = async () => {
    if (!employee?.id) return
    const confirmed = await window.fuchsiusConfirm('Remove your profile picture?', {
      title: 'Remove Profile Picture',
      confirmLabel: 'Remove',
    })
    if (!confirmed) return
    setAvatarLoading(true)
    setProfileMsg('')
    try {
      await employeesApi.deleteAvatar(employee.id)
      set('avatar', null)
      await updateUserProfile({ name: form.name, title: form.role, dept: form.dept, avatar: null })
      await fetchEmployees()
      setProfileMsg('Profile picture removed.')
    } catch (err) {
      setProfileMsg(err.response?.data?.error || err.message || 'Failed to remove profile picture.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const setPassword = (key, value) => setPasswordForm(prev => ({ ...prev, [key]: value }))

  const submitPassword = async () => {
    setPasswordMsg('')
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setPasswordMsg('Current and new password are required.')
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMsg('New password must be at least 8 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMsg('New passwords do not match.')
      return
    }
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordMsg('Password updated successfully.')
    } catch (err) {
      setPasswordMsg(err.response?.data?.error || err.message || 'Failed to update password.')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 gap-2 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /> Loading...</div>
  if (!isLinked) return <div className="card p-8 text-center text-sm text-gray-500">No linked employee record found for this account. Please ask HR to link your employee profile.</div>

  return (
    <div className="max-w-5xl space-y-4">
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <AvatarUploader
            name={form.name}
            avatar={form.avatar}
            loading={avatarLoading}
            onFile={uploadAvatar}
            onRemove={removeAvatar}
          />
          <div className="flex-1 w-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{form.name}</h2>
                <p className="text-sm text-gray-500">{form.role} - {form.dept}</p>
                <span className="badge-green mt-1">Active</span>
              </div>
              <button onClick={() => editing ? save() : setEditing(true)} className="btn-secondary text-xs">
                {editing ? <><Save className="w-3.5 h-3.5" /> Save</> : <><Edit2 className="w-3.5 h-3.5" /> Edit</>}
              </button>
            </div>
            {profileMsg && <p className="text-xs text-gray-500 mt-3">{profileMsg}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-500" /> Personal Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label:'Full Name', key:'name', icon:User },
                { label:'Email', key:'email', icon:Mail },
                { label:'Phone', key:'phone', icon:Phone },
                { label:'Home Address', key:'address', icon:Building2 },
              ].map(({ label, key, icon: Icon }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  {editing && key !== 'email' ? (
                    <input className="input" value={form[key]} onChange={e => set(key, e.target.value)} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-700 py-2">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />{form[key]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" /> Employment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Employee ID', employee.id],
                ['Department', form.dept],
                ['Job Title', form.role],
                ['Manager', form.manager],
                ['Join Date', form.joined],
                ['Type', employee.employmentType || 'Full-time'],
              ].map(([key, value]) => (
                <div key={key}>
                  <p className="label">{key}</p>
                  <p className="text-sm text-gray-700 font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Emergency Contact</h3>
            <div className="space-y-3">
              {[
                { label:'Name', key:'emergencyName' },
                { label:'Relationship', key:'emergencyRel' },
                { label:'Phone', key:'emergencyPhone' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  {editing ? (
                    <input className="input" value={form[key]} onChange={e => set(key, e.target.value)} />
                  ) : (
                    <p className="text-sm text-gray-700 py-1">{form[key]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-500" /> Change Password
            </h3>
            <div className="space-y-3">
              <input className="input" type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={e => setPassword('currentPassword', e.target.value)} />
              <input className="input" type="password" placeholder="New password" value={passwordForm.newPassword} onChange={e => setPassword('newPassword', e.target.value)} />
              <input className="input" type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={e => setPassword('confirmPassword', e.target.value)} />
              <button className="btn-secondary text-xs" onClick={submitPassword}>Update Password</button>
              {passwordMsg && <p className="text-xs text-gray-500">{passwordMsg}</p>}
            </div>
          </div>
        </div>
      </div>

      <DocumentVault employeeId={employee.id} />
    </div>
  )
}
