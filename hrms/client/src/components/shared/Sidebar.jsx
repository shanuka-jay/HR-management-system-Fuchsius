import React, { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { BarChart2, LogOut, ChevronLeft, ChevronRight, ChevronDown, Bell } from 'lucide-react'
import { useHR } from '../../context/HRContext'

export default function Sidebar({
  navGroups,
  portalLabel,
  accentColor = 'bg-gray-900',
}) {
  const { user, logout } = useAuth()
  const { notifications, isNotificationRead } = useHR()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [openGroups, setOpenGroups] = useState({})

  const unread = notifications.filter((n) => !isNotificationRead(n, user?.role)).length

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`flex flex-col bg-gray-950 border-r border-gray-800 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      } flex-shrink-0 h-screen sticky top-0`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
        <div
          className={`w-8 h-8 ${accentColor} rounded-md flex items-center justify-center flex-shrink-0 ring-1 ring-white/10`}
        >
          <BarChart2 className="w-4 h-4 text-white" />
        </div>

        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-white text-sm leading-tight">
              Fuchsius HRMS
            </div>
            <div className="text-xs text-gray-500 truncate">
              {portalLabel}
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-md text-gray-500 hover:bg-white/10 hover:text-white flex-shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="w-full flex items-center justify-center p-2 mb-2 rounded-md bg-white/10 text-white hover:bg-white/20"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {navGroups.map((group, groupIndex) => {
          const groupKey = group.key || group.label || `group-${groupIndex}`
          const isWorkspace = group.collapsible || group.label === 'My Workspace'
          const hasActiveItem = group.items.some(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
          const groupOpen = !isWorkspace || (openGroups[groupKey] ?? hasActiveItem)

          return (
          <div key={groupKey}>
            {!collapsed && group.label && !isWorkspace && (
              <div className="nav-group-label">{group.label}</div>
            )}
            {!collapsed && group.label && isWorkspace && (
              <button
                type="button"
                onClick={() => setOpenGroups(prev => ({ ...prev, [groupKey]: !groupOpen }))}
                className="w-full flex items-center gap-2 px-3 pt-4 pb-2 text-xs font-bold text-gray-500 uppercase tracking-widest hover:text-gray-300"
              >
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
              </button>
            )}

            {(groupOpen || collapsed) && group.items.map(({ to, icon: Icon, label, badge }) => (
              <NavLink
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  isActive
                    ? 'nav-link-active mb-0.5 relative'
                    : 'nav-link mb-0.5 relative'
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />

                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}

                {badge && !collapsed && (
                    <span className="ml-auto bg-gray-800 text-white text-xs rounded-full px-1.5 py-0.5 font-semibold">
                    {badge}
                  </span>
                )}

                {badge && collapsed && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </NavLink>
            ))}
          </div>
        )})}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-800 px-2 py-3">
        {!collapsed && unread > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1 text-xs text-gray-400">
            <Bell className="w-3.5 h-3.5" />
            <span>{unread} unread notifications</span>
          </div>
        )}

        <div
          className={`flex items-center gap-3 px-3 py-2 rounded-md bg-white/5 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center flex-shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-gray-900">{user?.name?.charAt(0)}</span>
            )}
          </div>

          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user?.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {user?.title}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-400 hover:bg-white/10 hover:text-white transition-colors mt-1 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
