import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

const cleanPath = (url = '') => String(url).split('?')[0]

const toastSuccess = (message) => {
  if (!message) return
  window.fuchsiusToast?.(message, 'success')
}

const getSuccessToastMessage = (response) => {
  const method = String(response.config?.method || '').toLowerCase()
  if (!['post', 'put', 'patch', 'delete'].includes(method)) return null

  const path = cleanPath(response.config?.url)
  const dataMessage = response.data?.message

  if (path === '/auth/login') return 'Login successful. Welcome back.'
  if (path === '/auth/logout') return 'Logged out successfully.'
  if (path === '/auth/change-password') return 'Password updated successfully.'

  if (path === '/attendance/checkin') return dataMessage || 'Checked in successfully.'
  if (path === '/attendance/checkout') return dataMessage || 'Checked out successfully.'
  if (path === '/attendance/corrections') return 'Attendance correction request submitted.'
  if (/^\/attendance\/corrections\/[^/]+$/.test(path)) return 'Attendance correction decision saved.'
  if (/^\/attendance\/[^/]+$/.test(path)) return 'Attendance record updated.'

  if (path === '/employees' && method === 'post') return 'Employee created successfully.'
  if (/^\/employees\/[^/]+$/.test(path) && method === 'put') return 'Employee profile updated.'
  if (/^\/employees\/[^/]+$/.test(path) && method === 'delete') return 'Employee deactivated and login access blocked.'
  if (/^\/employees\/[^/]+\/avatar$/.test(path) && method === 'post') return 'Profile picture updated.'
  if (/^\/employees\/[^/]+\/avatar$/.test(path) && method === 'delete') return 'Profile picture removed.'
  if (/^\/employees\/[^/]+\/documents$/.test(path) && method === 'post') return 'Document uploaded successfully.'
  if (/^\/employees\/[^/]+\/documents\/[^/]+\/verify$/.test(path)) return 'Document verified.'
  if (/^\/employees\/[^/]+\/documents\/[^/]+$/.test(path) && method === 'delete') return 'Document removed.'

  if (path === '/leaves' && method === 'post') return 'Leave request submitted.'
  if (/^\/leaves\/[^/]+\/approve$/.test(path)) return 'Leave request approved.'
  if (/^\/leaves\/[^/]+\/reject$/.test(path)) return 'Leave request rejected.'

  if (path === '/payroll/settings') return 'Payroll settings saved.'
  if (/^\/payroll\/compensation\/[^/]+$/.test(path)) return 'Compensation structure saved.'
  if (/^\/payroll\/variables\/[^/]+\/.+$/.test(path)) return 'Variable payroll inputs saved.'
  if (path === '/payroll/run') return dataMessage || 'Payroll draft generated.'
  if (/^\/payroll\/[^/]+\/approve$/.test(path)) return 'Payroll record approved.'
  if (/^\/payroll\/[^/]+\/pay$/.test(path)) return 'Payroll marked as paid.'
  if (/^\/payroll\/[^/]+$/.test(path)) return 'Payroll record updated.'

  if (path === '/jobs' && method === 'post') return 'Job opening posted.'
  if (/^\/jobs\/[^/]+\/close$/.test(path)) return 'Job opening closed.'
  if (/^\/jobs\/[^/]+\/reopen$/.test(path)) return 'Job opening reopened.'
  if (/^\/jobs\/[^/]+$/.test(path) && method === 'delete') return dataMessage || 'Job opening removed.'

  if (path === '/candidates' && method === 'post') return 'Candidate added.'
  if (/^\/candidates\/[^/]+$/.test(path) && method === 'put') return 'Candidate updated.'
  if (/^\/candidates\/[^/]+\/move$/.test(path)) return 'Candidate moved to next stage.'
  if (/^\/candidates\/[^/]+\/reject$/.test(path)) return 'Candidate rejected.'
  if (/^\/candidates\/[^/]+\/convert$/.test(path)) return 'Candidate onboarded as employee.'

  if (path === '/performance/cycles' && method === 'post') return 'Performance cycle created.'
  if (/^\/performance\/cycles\/[^/]+\/launch$/.test(path)) return 'Performance cycle launched.'
  if (/^\/performance\/cycles\/[^/]+\/complete$/.test(path)) return 'Performance cycle completed.'
  if (/^\/performance\/reviews\/[^/]+\/self-review$/.test(path)) return 'Self review submitted.'
  if (/^\/performance\/reviews\/[^/]+\/calibrate$/.test(path)) return 'Performance calibration saved.'
  if (/^\/performance\/reviews\/[^/]+$/.test(path)) return 'Performance review updated.'
  if (path === '/performance/goals' && method === 'post') return 'Goal created.'
  if (/^\/performance\/goals\/[^/]+$/.test(path) && method === 'delete') return 'Goal deleted.'
  if (/^\/performance\/goals\/[^/]+$/.test(path)) return 'Goal updated.'

  if (path === '/departments' && method === 'post') return 'Department created.'
  if (/^\/departments\/[^/]+$/.test(path)) return 'Department updated.'

  if (path === '/users' && method === 'post') return 'User created.'
  if (/^\/users\/[^/]+$/.test(path) && method === 'put') return 'User updated.'
  if (/^\/users\/[^/]+$/.test(path) && method === 'delete') {
    if (response.config?.params?.permanent === 'true') return dataMessage || 'User permanently deleted.'
    return 'User deactivated.'
  }
  if (path === '/users/me/profile') return 'Profile saved.'

  if (path === '/notifications' && method === 'post') return 'Notification sent.'
  if (path === '/settings') return 'Settings saved.'
  if (path === '/audit-logs/old') return dataMessage || 'Old audit logs purged.'

  if (dataMessage) return dataMessage

  const fallback = {
    post: 'Created successfully.',
    put: 'Updated successfully.',
    patch: 'Saved successfully.',
    delete: 'Deleted successfully.',
  }
  return fallback[method]
}

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fuchsius:token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor: show workflow feedback and handle 401
api.interceptors.response.use(
  (response) => {
    if (!response.config?.suppressToast) {
      toastSuccess(getSuccessToastMessage(response))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fuchsius:token')
      localStorage.removeItem('fuchsius:currentUser')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
