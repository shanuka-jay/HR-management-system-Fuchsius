import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'
import TopBar from '../../components/shared/TopBar'
import { LayoutDashboard, Users, CalendarCheck, Clock, TrendingUp, DollarSign, User } from 'lucide-react'
import { useHR } from '../../context/HRContext'
import useManagerTeam from '../../hooks/useManagerTeam'

const pageTitles = {
  '/manager/dashboard':   'Manager Dashboard',
  '/manager/team':        'Team Directory',
  '/manager/leave':       'Leave Approval',
  '/manager/attendance':  'Team Attendance',
  '/manager/performance': 'Team Performance',
  '/manager/profile':     'My Profile',
  '/manager/settings':    'Settings',
  '/manager/my-dashboard': 'My Employee Dashboard',
  '/manager/my-attendance':'My Attendance',
  '/manager/my-leave':    'My Leave',
  '/manager/my-payroll':  'My Payroll',
  '/manager/my-performance':'My Performance',
}

export default function ManagerLayout() {
  const location = useLocation()
  const { leaveRequests } = useHR()
  const { teamIds } = useManagerTeam()
  const pendingForManager = leaveRequests.filter(l => teamIds.includes(l.empId) && l.status === 'Pending').length
  const navGroups = [
    {
      label:'Overview',
      items:[ { to:'/manager/dashboard', icon:LayoutDashboard, label:'Dashboard' } ],
    },
    {
      label:'My Team',
      items:[
        { to:'/manager/team',        icon:Users,        label:'Team Directory'    },
        { to:'/manager/leave',       icon:CalendarCheck,label:'Leave Approval', badge: pendingForManager || undefined },
        { to:'/manager/attendance',  icon:Clock,        label:'Team Attendance'   },
        { to:'/manager/performance', icon:TrendingUp,   label:'Performance'       },
      ],
    },
    {
      label:'My Workspace',
      items:[
        { to:'/manager/my-dashboard',  icon:LayoutDashboard, label:'My Dashboard' },
        { to:'/manager/profile',       icon:User,            label:'My Profile' },
        { to:'/manager/my-attendance', icon:Clock,           label:'My Attendance' },
        { to:'/manager/my-leave',      icon:CalendarCheck,   label:'My Leave' },
        { to:'/manager/my-payroll',    icon:DollarSign,      label:'My Payroll' },
        { to:'/manager/my-performance',icon:TrendingUp,      label:'My Performance' },
      ],
    },
  ]
  const title = pageTitles[location.pathname] || 'Manager'
  return (
    <div className="app-shell">
      <Sidebar navGroups={navGroups} portalLabel="Manager Portal" accentColor="bg-gray-700" />
      <div className="content-shell">
        <TopBar title={title} />
        <main className="content-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
