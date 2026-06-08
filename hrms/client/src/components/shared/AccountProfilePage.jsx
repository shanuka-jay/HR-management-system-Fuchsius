import React, { useEffect, useState } from 'react'
import { KeyRound, Mail, Save, Shield, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useHR } from '../../context/HRContext'
import { employeesApi } from '../../api/services'
import AvatarUploader from './AvatarUploader'
import DocumentVault from './DocumentVault'
import useCurrentEmployee from '../../hooks/useCurrentEmployee'

export default function AccountProfilePage() {
  const { user, updateUserProfile, changePassword } = useAuth()
  const { employee } = useCurrentEmployee()
  const { fetchEmployees } = useHR()
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    title: user?.title || '',
    dept: user?.dept || '',
    avatar: employee?.avatar || user?.avatar || null,
  })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMsg, setPasswordMsg] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      title: user?.title || '',
      dept: user?.dept || '',
      avatar: employee?.avatar || user?.avatar || null,
    })
  }, [user?.id, user?.avatar, employee?.id, employee?.avatar])

  const save = async () => {
    setProfileMsg('')
    try {
      await updateUserProfile(form)
      await fetchEmployees()
      setProfileMsg('Profile updated across the portal.')
    } catch (err) {
      setProfileMsg(err.response?.data?.error || err.message || 'Failed to save profile.')
    }
  }

  const uploadAvatar = async (file) => {
    setProfileMsg('')
    if (!employee?.id) {
      const reader = new FileReader()
      reader.onload = async () => {
        const avatar = reader.result
        set('avatar', avatar)
        await updateUserProfile({ ...form, avatar })
        setProfileMsg('Profile picture updated for this user account. Link an employee profile to share it with attendance and team views.')
      }
      reader.onerror = () => setProfileMsg('Failed to read profile picture.')
      reader.readAsDataURL(file)
      return
    }
    setAvatarLoading(true)
    try {
      const res = await employeesApi.uploadAvatar(employee.id, file)
      const avatar = res.data.avatar
      set('avatar', avatar)
      await updateUserProfile({ name: form.name, title: form.title, dept: form.dept, avatar })
      await fetchEmployees()
      setProfileMsg('Profile picture updated.')
    } catch (err) {
      setProfileMsg(err.response?.data?.error || err.message || 'Failed to upload profile picture.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const removeAvatar = async () => {
    setProfileMsg('')
    if (!employee?.id) {
      set('avatar', null)
      await updateUserProfile({ ...form, avatar: null })
      setProfileMsg('Profile picture removed from your account.')
      return
    }
    const confirmed = await window.fuchsiusConfirm('Remove your profile picture?', {
      title: 'Remove Profile Picture',
      confirmLabel: 'Remove',
    })
    if (!confirmed) return
    setAvatarLoading(true)
    try {
      await employeesApi.deleteAvatar(employee.id)
      set('avatar', null)
      await updateUserProfile({ name: form.name, title: form.title, dept: form.dept, avatar: null })
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

  return (
    <div className="max-w-5xl space-y-5">
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
          <AvatarUploader
            name={form.name}
            avatar={form.avatar}
            loading={avatarLoading}
            onFile={uploadAvatar}
            onRemove={removeAvatar}
          />
          <div className="flex-1">
            <p className="page-kicker">Account Profile</p>
            <h2 className="text-2xl font-black text-gray-950">{form.name}</h2>
            <p className="text-sm text-gray-500">{form.title} in {form.dept}</p>
          </div>
          <button className="btn-primary" onClick={save}><Save className="w-4 h-4" /> Save Profile</button>
        </div>
        {profileMsg && <p className="mt-3 text-xs text-gray-500">{profileMsg}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <UserRound className="w-4 h-4 text-gray-500" /> Profile Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Job Title</label>
              <input className="input" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.dept} onChange={e => set('dept', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" /> Portal Access
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="label">Role</p>
              <p className="font-semibold capitalize">{user?.role}</p>
            </div>
            <div>
              <p className="label">Email Login</p>
              <p className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4" />{form.email}</p>
            </div>
            <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              Profile data is shared with header navigation, sidebar identity, document uploads, approvals and notifications.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-gray-500" /> Change Password
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input" type="password" placeholder="Current password" value={passwordForm.currentPassword} onChange={e => setPassword('currentPassword', e.target.value)} />
          <input className="input" type="password" placeholder="New password" value={passwordForm.newPassword} onChange={e => setPassword('newPassword', e.target.value)} />
          <input className="input" type="password" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={e => setPassword('confirmPassword', e.target.value)} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-secondary text-xs" onClick={submitPassword}>Update Password</button>
          {passwordMsg && <span className="text-xs text-gray-500">{passwordMsg}</span>}
        </div>
      </div>

      {employee?.id ? (
        <DocumentVault employeeId={employee.id} canVerify={user?.role === 'hr'} />
      ) : (
        <div className="card p-5 text-sm text-gray-500">No linked employee record found for this account.</div>
      )}
    </div>
  )
}
