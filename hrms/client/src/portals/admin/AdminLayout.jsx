import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'
import TopBar from '../../components/shared/TopBar'
import {
  LayoutDashboard, Building2, Users, ShieldCheck,
  Settings, FileText, Clock, User, CalendarCheck, DollarSign, TrendingUp
} from 'lucide-react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { to:'/admin/dashboard',    icon:LayoutDashboard, label:'Dashboard'         },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to:'/admin/organization', icon:Building2,       label:'Organization'     },
      { to:'/admin/users',        icon:Users,           label:'User Management'  },
      { to:'/admin/attendance',   icon:Clock,           label:'Attendance'       },
    ],
  },
  {
    label: 'System',
    items: [
      { to:'/admin/audit',        icon:FileText,        label:'Audit Logs'       },
      { to:'/admin/settings',     icon:Settings,        label:'Settings'         },
    ],
  },
  {
    label: 'My Workspace',
    items: [
      { to:'/admin/my-dashboard',  icon:LayoutDashboard, label:'My Dashboard'     },
      { to:'/admin/profile',       icon:User,            label:'My Profile'       },
      { to:'/admin/my-attendance', icon:Clock,           label:'My Attendance'    },
      { to:'/admin/my-leave',      icon:CalendarCheck,   label:'My Leave'         },
      { to:'/admin/my-payroll',    icon:DollarSign,      label:'My Payroll'       },
      { to:'/admin/my-performance',icon:TrendingUp,      label:'My Performance'   },
    ],
  },
]

const pageTitles = {
  '/admin/dashboard':    'Admin Dashboard',
  '/admin/organization': 'Organization',
  '/admin/users':        'User Management',
  '/admin/attendance':   'Attendance',
  '/admin/audit':        'Audit Logs',
  '/admin/settings':     'System Settings',
  '/admin/profile':      'My Profile',
  '/admin/my-dashboard':  'My Employee Dashboard',
  '/admin/my-attendance': 'My Attendance',
  '/admin/my-leave':      'My Leave',
  '/admin/my-payroll':    'My Payroll',
  '/admin/my-performance':'My Performance',
}

export default function AdminLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Admin'
  return (
    <div className="app-shell">
      <Sidebar navGroups={navGroups} portalLabel="Admin Portal" accentColor="bg-gray-900" />
      <div className="content-shell">
        <TopBar title={title} />
        <main className="content-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
