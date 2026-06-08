import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'
import TopBar from '../../components/shared/TopBar'
import { useHR } from '../../context/HRContext'
import { isLeaveActionableByHR } from '../../utils/leaveStatus'
import {
  LayoutDashboard, Users, Briefcase,
  Clock, CalendarCheck, DollarSign, TrendingUp, BarChart2,
  User,
} from 'lucide-react'

const pageTitles = {
  '/hr/dashboard':   'HR Dashboard',
  '/hr/employees':   'Employees',
  '/hr/recruitment': 'Recruitment',
  '/hr/attendance':  'Attendance',
  '/hr/leave':       'Leave Management',
  '/hr/payroll':     'Payroll',
  '/hr/performance': 'Performance',
  '/hr/reports':     'Reports & Analytics',
  '/hr/profile':     'My Profile',
  '/hr/settings':    'Settings',
  '/hr/my-dashboard': 'My Employee Dashboard',
  '/hr/my-attendance':'My Attendance',
  '/hr/my-leave':    'My Leave',
  '/hr/my-payroll':  'My Payroll',
  '/hr/my-performance':'My Performance',
}

export default function HRLayout() {
  const location = useLocation()
  const { leaveRequests } = useHR()

  // Recomputed live from context so the badge always reflects real state
  const pending = leaveRequests.filter(l => isLeaveActionableByHR(l.status, l)).length

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { to: '/hr/dashboard',   icon: LayoutDashboard, label: 'Dashboard' },
      ],
    },
    {
      label: 'Workforce',
      items: [
        { to: '/hr/employees',   icon: Users,       label: 'Employees' },
        { to: '/hr/recruitment', icon: Briefcase,   label: 'Recruitment' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { to: '/hr/attendance',  icon: Clock,        label: 'Attendance' },
        { to: '/hr/leave',       icon: CalendarCheck, label: 'Leave Management', badge: pending || undefined },
        { to: '/hr/payroll',     icon: DollarSign,   label: 'Payroll' },
      ],
    },
    {
      label: 'Growth',
      items: [
        { to: '/hr/performance', icon: TrendingUp,   label: 'Performance' },
        { to: '/hr/reports',     icon: BarChart2,    label: 'Reports' },
      ],
    },
    {
      label: 'My Workspace',
      items: [
        { to: '/hr/my-dashboard',  icon: LayoutDashboard, label: 'My Dashboard' },
        { to: '/hr/profile',       icon: User,            label: 'My Profile' },
        { to: '/hr/my-attendance', icon: Clock,           label: 'My Attendance' },
        { to: '/hr/my-leave',      icon: CalendarCheck,   label: 'My Leave' },
        { to: '/hr/my-payroll',    icon: DollarSign,      label: 'My Payroll' },
        { to: '/hr/my-performance',icon: TrendingUp,      label: 'My Performance' },
      ],
    },
  ]

  const title =
    Object.entries(pageTitles).find(([k]) => location.pathname.startsWith(k))?.[1] || 'HR'

  return (
    <div className="app-shell">
      <Sidebar navGroups={navGroups} portalLabel="HR Portal" accentColor="bg-gray-800" />
      <div className="content-shell">
        <TopBar title={title} />
        <main className="content-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
