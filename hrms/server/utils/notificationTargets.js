const csv = (values) => [...new Set((values || []).filter(Boolean))].join(',')

const getDirectManagerUserId = async (prisma, employee) => {
  if (!employee) return ''
  let manager = null
  if (employee.managerId) {
    manager = await prisma.employee.findUnique({
      where: { id: employee.managerId },
      select: { userId: true },
    })
  }
  if (!manager?.userId && employee.manager) {
    manager = await prisma.employee.findFirst({
      where: { name: employee.manager },
      select: { userId: true },
    })
  }
  if (!manager?.userId && employee.manager) {
    manager = await prisma.user.findFirst({
      where: { name: employee.manager, role: { in: ['manager', 'hr', 'admin'] }, status: 'Active' },
      select: { id: true },
    })
    return manager?.id || ''
  }
  return manager?.userId || ''
}

const createNotification = (prisma, data) => prisma.notification.create({
  data: {
    type: data.type || 'system',
    msg: data.msg,
    path: data.path || '/',
    audience: Array.isArray(data.audience) ? csv(data.audience) : (data.audience || ''),
    userIds: Array.isArray(data.userIds) ? csv(data.userIds) : (data.userIds || ''),
    dept: data.dept || null,
  },
})

module.exports = { csv, getDirectManagerUserId, createNotification }
