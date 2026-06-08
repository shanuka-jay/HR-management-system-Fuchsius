import api from './api'

export const authApi = {
  login:          (email, password) => api.post('/auth/login', { email, password }),
  google:         (credential)      => api.post('/auth/google', { credential }),
  forgotPassword: (email)           => api.post('/auth/forgot-password', { email }),
  me:             ()                => api.get('/auth/me'),
  logout:         ()                => api.post('/auth/logout'),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
}

export const employeesApi = {
  list:           (params)      => api.get('/employees', { params }),
  managers:       ()            => api.get('/employees/managers'),
  get:            (id)          => api.get(`/employees/${id}`),
  create:         (data)        => api.post('/employees', data),
  update:         (id, data)    => api.put(`/employees/${id}`, data),
  delete:         (id)          => api.delete(`/employees/${id}`),
  deletePermanent:(id)          => api.delete(`/employees/${id}/permanent`),
  uploadAvatar:   (id, file)    => {
    const fd = new FormData(); fd.append('avatar', file)
    return api.post(`/employees/${id}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  deleteAvatar:   (id)          => api.delete(`/employees/${id}/avatar`),
  getDocuments:   (id)          => api.get(`/employees/${id}/documents`),
  uploadDocument: (id, file, category) => {
    const fd = new FormData(); fd.append('file', file); fd.append('category', category || 'General')
    return api.post(`/employees/${id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  verifyDocument: (id, docId)   => api.patch(`/employees/${id}/documents/${docId}/verify`),
  deleteDocument: (id, docId)   => api.delete(`/employees/${id}/documents/${docId}`),
}

export const leavesApi = {
  list:    (params) => api.get('/leaves', { params }),
  apply:   (data)   => api.post('/leaves', data),
  approve: (id, note) => api.patch(`/leaves/${id}/approve`, { note }),
  reject:  (id, note) => api.patch(`/leaves/${id}/reject`, { note }),
}

export const attendanceApi = {
  me:        ()      => api.get('/attendance/me'),
  today:     ()      => api.get('/attendance/today'),
  monthly:   ()      => api.get('/attendance/monthly'),
  employee:  (empId) => api.get(`/attendance/employee/${empId}`),
  checkIn:   ()      => api.post('/attendance/checkin'),
  checkOut:  ()      => api.post('/attendance/checkout'),
  correct:   (id, data) => api.patch(`/attendance/${id}`, data),
  corrections: (params) => api.get('/attendance/corrections', { params }),
  requestCorrection: (data) => api.post('/attendance/corrections', data),
  decideCorrection: (id, data) => api.patch(`/attendance/corrections/${id}`, data),
}

export const payrollApi = {
  list:        (params) => api.get('/payroll', { params }),
  settings:    ()      => api.get('/payroll/settings'),
  updateSettings: (data) => api.put('/payroll/settings', data),
  compensation: (empId) => api.get(`/payroll/compensation/${empId}`),
  updateCompensation: (empId, data) => api.put(`/payroll/compensation/${empId}`, data),
  variables:   (empId, month) => api.get(`/payroll/variables/${empId}/${encodeURIComponent(month)}`),
  updateVariables: (empId, month, data) => api.put(`/payroll/variables/${empId}/${encodeURIComponent(month)}`, data),
  monthlyTrend: ()      => api.get('/payroll/monthly-trend'),
  employee:    (empId)  => api.get(`/payroll/employee/${empId}`),
  run:         (month)  => api.post('/payroll/run', { month }),
  updateRecord: (id, data) => api.patch(`/payroll/${id}`, data),
  approve:     (id)     => api.patch(`/payroll/${id}/approve`),
  pay:         (id)     => api.patch(`/payroll/${id}/pay`),
  approveDrafts: (month) => api.post('/payroll/approve-drafts', { month }),
  payApproved: (month)  => api.post('/payroll/pay-approved', { month }),
}

export const jobsApi = {
  list:   (params) => api.get('/jobs', { params }),
  create: (data)   => api.post('/jobs', data),
  close:  (id)     => api.patch(`/jobs/${id}/close`),
  reopen: (id)     => api.patch(`/jobs/${id}/reopen`),
  delete: (id)     => api.delete(`/jobs/${id}`),
}

export const candidatesApi = {
  list:   (params) => api.get('/candidates', { params }),
  create: (data)   => {
    const fd = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') fd.append(key, value)
    })
    return api.post('/candidates', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  update: (id, data) => {
    const fd = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) fd.append(key, value)
    })
    return api.put(`/candidates/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  convert: (id, data) => api.post(`/candidates/${id}/convert`, data),
  move:   (id, stage) => api.patch(`/candidates/${id}/move`, { stage }),
  reject: (id)     => api.patch(`/candidates/${id}/reject`),
}

export const performanceApi = {
  reviews:      (params) => api.get('/performance/reviews', { params }),
  updateReview: (id, data) => api.patch(`/performance/reviews/${id}`, data),
  selfReview:   (id, selfReview) => api.patch(`/performance/reviews/${id}/self-review`, { selfReview }),
  calibrateReview: (id, data) => api.patch(`/performance/reviews/${id}/calibrate`, data),
  cycles:       ()       => api.get('/performance/cycles'),
  createCycle:  (data)   => api.post('/performance/cycles', data),
  launchCycle:  (id)     => api.patch(`/performance/cycles/${id}/launch`),
  completeCycle: (id)    => api.patch(`/performance/cycles/${id}/complete`),
  goals:        (empId)  => api.get(`/performance/goals/${empId}`),
  createGoal:   (data)   => api.post('/performance/goals', data),
  updateGoal:   (id, data) => api.patch(`/performance/goals/${id}`, data),
  deleteGoal:   (id)     => api.delete(`/performance/goals/${id}`),
}

export const departmentsApi = {
  list:   ()        => api.get('/departments'),
  create: (data)    => api.post('/departments', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
}

export const usersApi = {
  list:   ()        => api.get('/users'),
  create: (data)    => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id)      => api.delete(`/users/${id}`),
  deletePermanent: (id) => api.delete(`/users/${id}`, { params: { permanent: 'true' } }),
  updateMyProfile: (data) => api.put('/users/me/profile', data),
}

export const notificationsApi = {
  list:    ()   => api.get('/notifications'),
  create:  (data) => api.post('/notifications', data),
  read:    (id) => api.patch(`/notifications/${id}/read`),
  readAll: ()   => api.patch('/notifications/read-all'),
}

export const reportsApi = {
  summary:   () => api.get('/reports/summary'),
  analytics: () => api.get('/reports/analytics'),
  exportRows: (type, params) => api.get(`/reports/export/${type}`, { params }),
}

export const auditLogsApi = {
  list: (params) => api.get('/audit-logs', { params }),
  purgeOld: (retentionMonths) => api.delete('/audit-logs/old', { data: { retentionMonths } }),
}

export const settingsApi = {
  get:    ()     => api.get('/settings'),
  status: ()     => api.get('/settings/status'),
  update: (data) => api.put('/settings', data),
}

export const holidaysApi = {
  list: () => api.get('/holidays'),
}
