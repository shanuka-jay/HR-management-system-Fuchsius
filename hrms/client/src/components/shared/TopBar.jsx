import React, { useState } from 'react'
import {
  Bell,
  Briefcase,
  CalendarCheck,
  CheckCheck,
  ChevronDown,
  Clock,
  DollarSign,
  FileText,
  LogOut,
  Settings,
  Sparkles,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useHR } from '../../context/HRContext'
import { useNavigate } from 'react-router-dom'

export default function TopBar({ title }) {
  const { user, logout } = useAuth()
  const { notifications, isNotificationRead, markNotificationRead, markAllNotificationsRead } = useHR()
  const navigate = useNavigate()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showAccount, setShowAccount] = useState(false)

  const role = user?.role
  const visibleNotifications = notifications
  const unread = visibleNotifications.filter((n) => !n.read).length
  const latestNotifications = visibleNotifications.slice(0, 8)

  const notificationMeta = {
    attendance: { icon: Clock, label: 'Attendance', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    candidate: { icon: Briefcase, label: 'Recruitment', color: 'bg-violet-50 text-violet-700 border-violet-100' },
    document: { icon: FileText, label: 'Documents', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    employee: { icon: UserPlus, label: 'Employee', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    leave: { icon: CalendarCheck, label: 'Leave', color: 'bg-rose-50 text-rose-700 border-rose-100' },
    payroll: { icon: DollarSign, label: 'Payroll', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    review: { icon: Sparkles, label: 'Performance', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
    system: { icon: Bell, label: 'System', color: 'bg-gray-50 text-gray-700 border-gray-100' },
  }

  const formatNotificationTime = (raw) => {
    if (!raw) return ''
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return raw
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const openNotification = (notification) => {
    markNotificationRead(notification.id)
    setShowNotifs(false)
    if (notification.path) navigate(notification.path)
  }

  const goTo = (path) => {
    setShowAccount(false)
    navigate(path)
  }

  const handleLogout = () => {
    setShowAccount(false)
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white/90 backdrop-blur border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
      <div className="flex-1">
        <h1 className="text-sm font-bold text-gray-950">
          {title}
        </h1>
        <p className="text-xs text-gray-500 hidden sm:block">
          {user?.department} workspace
        </p>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative p-2 rounded-md hover:bg-gray-100 text-gray-600 transition"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />

          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowNotifs(false)}
            />

            <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-modal z-30">
              <div className="bg-gray-950 px-4 py-3 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold">Notifications</span>
                    <p className="text-xs text-gray-400">{unread} unread · {visibleNotifications.length} total</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      className="p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-40"
                      onClick={() => markAllNotificationsRead()}
                      title="Mark all as read"
                      disabled={!visibleNotifications.length}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-gray-300 hover:text-white hover:bg-white/10" onClick={() => setShowNotifs(false)}>
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <div>
                  <p className="text-xs font-semibold text-gray-700">Latest activity</p>
                  <p className="text-xs text-gray-400">Role-filtered for {role || 'current'} workspace</p>
                </div>
                {unread > 0 && <span className="badge-yellow">{unread} new</span>}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {latestNotifications.map((notification) => {
                  const isRead = isNotificationRead(notification, role)
                  const meta = notificationMeta[notification.type] || notificationMeta.system
                  const Icon = meta.icon
                  return (
                  <button
                    key={notification.id}
                    onClick={() => openNotification(notification)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition hover:bg-gray-50 ${
                      !isRead ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${meta.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase text-gray-400">{meta.label}</span>
                          <span className="text-[11px] text-gray-400">{formatNotificationTime(notification.time)}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${isRead ? 'text-gray-500' : 'font-semibold text-gray-900'}`}>
                          {notification.msg}
                        </p>
                      </div>
                      {!isRead && <span className="mt-2 h-2 w-2 rounded-full bg-gray-950 flex-shrink-0" />}
                    </div>
                  </button>
                  )
                })}
                {visibleNotifications.length > latestNotifications.length && (
                  <div className="px-4 py-2 text-center text-xs text-gray-400">
                    Showing latest {latestNotifications.length} of {visibleNotifications.length}
                  </div>
                )}
                {visibleNotifications.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                      <Bell className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">No notifications</p>
                    <p className="mt-1 text-xs text-gray-400">Workflow alerts will appear here when something needs attention.</p>
                  </div>
                )}
              </div>

              {visibleNotifications.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 bg-white px-4 py-2.5">
                  <span className="text-xs text-gray-400">{unread ? `${unread} unread remaining` : 'All caught up'}</span>
                  <button
                    className="text-xs font-semibold text-gray-700 hover:text-gray-950 disabled:text-gray-300"
                    onClick={() => markAllNotificationsRead()}
                    disabled={!unread}
                  >
                    Mark all read
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Avatar */}
      <div className="relative">
        <button
          onClick={() => setShowAccount(!showAccount)}
          className="flex items-center gap-2 rounded-md hover:bg-gray-100 px-2 py-1.5 transition"
        >
          <div className="w-8 h-8 bg-gray-950 rounded-full flex items-center justify-center overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">{user?.name?.charAt(0)}</span>
            )}
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <p className="text-xs font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-gray-400" />
        </button>

        {showAccount && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowAccount(false)} />
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-modal z-30 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.title}</p>
              </div>
              <button className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => goTo(`/${role}/profile`)}>
                <User className="w-4 h-4 text-gray-400" /> Profile
              </button>
              <button className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2" onClick={() => goTo(`/${role}/settings`)}>
                <Settings className="w-4 h-4 text-gray-400" /> Settings
              </button>
              <button className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
