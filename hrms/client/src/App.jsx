import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { HRProvider } from './context/HRContext'
import LoginPage from './pages/LoginPage'
import AccountProfilePage from './components/shared/AccountProfilePage'
import PortalSettingsPage from './components/shared/PortalSettingsPage'
import AppAlerts from './components/shared/AppAlerts'

// Admin
import AdminLayout from './portals/admin/AdminLayout'
import AdminDashboard from './portals/admin/pages/AdminDashboard'
import AdminOrganization from './portals/admin/pages/AdminOrganization'
import AdminUsers from './portals/admin/pages/AdminUsers'
import AdminAuditLogs from './portals/admin/pages/AdminAuditLogs'
import AdminSettings from './portals/admin/pages/AdminSettings'

// HR
import HRLayout from './portals/hr/HRLayout'
import HRDashboard from './portals/hr/pages/HRDashboard'
import HREmployeeList from './portals/hr/pages/HREmployeeList'
import HREmployeeProfile from './portals/hr/pages/HREmployeeProfile'
import HRAddEmployee from './portals/hr/pages/HRAddEmployee'
import HRRecruitment from './portals/hr/pages/HRRecruitment'
import HRAttendance from './portals/hr/pages/HRAttendance'
import HRLeave from './portals/hr/pages/HRLeave'
import HRPayroll from './portals/hr/pages/HRPayroll'
import HRPerformance from './portals/hr/pages/HRPerformance'
import HRReports from './portals/hr/pages/HRReports'

// Manager
import ManagerLayout from './portals/manager/ManagerLayout'
import ManagerDashboard from './portals/manager/pages/ManagerDashboard'
import ManagerTeam from './portals/manager/pages/ManagerTeam'
import ManagerLeaveApproval from './portals/manager/pages/ManagerLeaveApproval'
import ManagerAttendance from './portals/manager/pages/ManagerAttendance'
import ManagerPerformance from './portals/manager/pages/ManagerPerformance'
import ManagerEmployeeReview from './portals/manager/pages/ManagerEmployeeReview'

// Employee
import EmployeeLayout from './portals/employee/EmployeeLayout'
import EmployeeDashboard from './portals/employee/pages/EmployeeDashboard'
import EmployeeProfile from './portals/employee/pages/EmployeeProfile'
import EmployeeAttendance from './portals/employee/pages/EmployeeAttendance'
import EmployeeLeave from './portals/employee/pages/EmployeeLeave'
import EmployeePayroll from './portals/employee/pages/EmployeePayroll'
import EmployeePerformance from './portals/employee/pages/EmployeePerformance'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RoleRouter() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  const redirects = {
    admin: '/admin/dashboard',
    hr: '/hr/dashboard',
    manager: '/manager/dashboard',
    employee: '/employee/dashboard',
  }
  return <Navigate to={redirects[user.role] || '/login'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <HRProvider>
        <AppAlerts />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRouter />} />

          {/* Admin Portal */}
          <Route
            path="/admin"
            element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"    element={<AdminDashboard />} />
            <Route path="organization" element={<AdminOrganization />} />
            <Route path="users"        element={<AdminUsers />} />
            <Route path="attendance"   element={<HRAttendance />} />
            <Route path="audit"        element={<AdminAuditLogs />} />
            <Route path="settings"     element={<AdminSettings />} />
            <Route path="profile"      element={<AccountProfilePage />} />
            <Route path="my-dashboard" element={<EmployeeDashboard />} />
            <Route path="my-attendance" element={<EmployeeAttendance />} />
            <Route path="my-leave"      element={<EmployeeLeave />} />
            <Route path="my-payroll"    element={<EmployeePayroll />} />
            <Route path="my-performance" element={<EmployeePerformance />} />
          </Route>

          {/* HR Portal */}
          <Route
            path="/hr"
            element={<ProtectedRoute><HRLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"     element={<HRDashboard />} />
            <Route path="employees"     element={<HREmployeeList />} />
            {/* IMPORTANT: 'employees/add' must come before 'employees/:id' */}
            <Route path="employees/add" element={<HRAddEmployee />} />
            <Route path="employees/:id" element={<HREmployeeProfile />} />
            <Route path="recruitment"   element={<HRRecruitment />} />
            <Route path="attendance"    element={<HRAttendance />} />
            <Route path="leave"         element={<HRLeave />} />
            <Route path="payroll"       element={<HRPayroll />} />
            <Route path="performance"   element={<HRPerformance />} />
            <Route path="reports"       element={<HRReports />} />
            <Route path="profile"       element={<AccountProfilePage />} />
            <Route path="settings"      element={<PortalSettingsPage />} />
            <Route path="my-dashboard"  element={<EmployeeDashboard />} />
            <Route path="my-attendance" element={<EmployeeAttendance />} />
            <Route path="my-leave"      element={<EmployeeLeave />} />
            <Route path="my-payroll"    element={<EmployeePayroll />} />
            <Route path="my-performance" element={<EmployeePerformance />} />
          </Route>

          {/* Manager Portal */}
          <Route
            path="/manager"
            element={<ProtectedRoute><ManagerLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"  element={<ManagerDashboard />} />
            <Route path="team"       element={<ManagerTeam />} />
            <Route path="team/:employeeId/review" element={<ManagerEmployeeReview />} />
            <Route path="leave"      element={<ManagerLeaveApproval />} />
            <Route path="attendance" element={<ManagerAttendance />} />
            <Route path="performance" element={<ManagerPerformance />} />
            <Route path="profile"     element={<AccountProfilePage />} />
            <Route path="settings"    element={<PortalSettingsPage />} />
            <Route path="my-dashboard" element={<EmployeeDashboard />} />
            <Route path="my-attendance" element={<EmployeeAttendance />} />
            <Route path="my-leave"      element={<EmployeeLeave />} />
            <Route path="my-payroll"    element={<EmployeePayroll />} />
            <Route path="my-performance" element={<EmployeePerformance />} />
          </Route>

          {/* Employee Portal */}
          <Route
            path="/employee"
            element={<ProtectedRoute><EmployeeLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"   element={<EmployeeDashboard />} />
            <Route path="profile"     element={<EmployeeProfile />} />
            <Route path="attendance"  element={<EmployeeAttendance />} />
            <Route path="leave"       element={<EmployeeLeave />} />
            <Route path="payroll"     element={<EmployeePayroll />} />
            <Route path="performance" element={<EmployeePerformance />} />
            <Route path="settings"    element={<PortalSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HRProvider>
    </AuthProvider>
  )
}
