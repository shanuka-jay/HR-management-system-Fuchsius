import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../../components/shared/Sidebar'
import TopBar from '../../components/shared/TopBar'
import { LayoutDashboard, User, Clock, CalendarCheck, DollarSign, TrendingUp } from 'lucide-react'

const navGroups = [
  {
    label:'My Workspace',
    items:[
      { to:'/employee/dashboard',   icon:LayoutDashboard, label:'Dashboard'        },
      { to:'/employee/profile',     icon:User,            label:'My Profile'       },
    ],
  },
  {
    label:'Self Service',
    items:[
      { to:'/employee/attendance',  icon:Clock,           label:'My Attendance'    },
      { to:'/employee/leave',       icon:CalendarCheck,   label:'My Leave'         },
      { to:'/employee/payroll',     icon:DollarSign,      label:'My Payroll'       },
      { to:'/employee/performance', icon:TrendingUp,      label:'My Performance'   },
    ],
  },
]

const pageTitles = {
  '/employee/dashboard':   'Employee Dashboard',
  '/employee/profile':     'My Profile',
  '/employee/attendance':  'My Attendance',
  '/employee/leave':       'My Leave',
  '/employee/payroll':     'My Payroll',
  '/employee/performance': 'My Performance',
  '/employee/settings':    'Settings',
}

export default function EmployeeLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Employee'
  return (
    <div className="app-shell">
      <Sidebar navGroups={navGroups} portalLabel="Employee Portal" accentColor="bg-gray-600" />
      <div className="content-shell">
        <TopBar title={title} />
        <main className="content-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
