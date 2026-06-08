export const isLeaveActionableByHR = (status, leave = null) => {
  if (status === 'Pending HR') return true
  if (status !== 'Pending') return false
  if (!leave) return true
  return !leave.managerId && !leave.manager
}

export const isLeaveActionableByManager = (status) => status === 'Pending'

export const leaveStatusLabel = (status) => {
  if (status === 'Pending HR') return 'Pending HR'
  return status || 'Pending'
}

export const leaveStatusClass = (status) => {
  if (status === 'Approved') return 'badge-green'
  if (status === 'Rejected') return 'badge-red'
  if (status === 'Pending HR') return 'badge-blue'
  return 'badge-yellow'
}
