const DEFAULT_ATTENDANCE_SETTINGS = {
  attendance_shift1_name: 'Morning Shift',
  attendance_shift1_start: '09:00',
  attendance_shift1_end: '17:00',
  attendance_shift2_name: 'Evening Shift',
  attendance_shift2_start: '13:00',
  attendance_shift2_end: '21:00',
  attendance_grace_minutes: '5',
  attendance_completion_buffer_minutes: '15',
}

const timeToMinutes = (time = '') => {
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

const minutesBetween = (start, end) => {
  let diff = timeToMinutes(end) - timeToMinutes(start)
  if (diff < 0) diff += 24 * 60
  return diff
}

const loadAttendanceSettings = async (prisma) => {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: 'attendance_' } },
  })
  const values = { ...DEFAULT_ATTENDANCE_SETTINGS }
  rows.forEach(row => { values[row.key] = row.value })
  return values
}

const getShifts = (settings) => ([
  {
    name: settings.attendance_shift1_name || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift1_name,
    start: settings.attendance_shift1_start || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift1_start,
    end: settings.attendance_shift1_end || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift1_end,
  },
  {
    name: settings.attendance_shift2_name || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift2_name,
    start: settings.attendance_shift2_start || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift2_start,
    end: settings.attendance_shift2_end || DEFAULT_ATTENDANCE_SETTINGS.attendance_shift2_end,
  },
])

const chooseShift = (checkIn, settings) => {
  const shifts = getShifts(settings)
  if (!checkIn) return shifts[0]
  const checkMinutes = timeToMinutes(checkIn)
  return shifts.reduce((best, shift) => {
    const distance = Math.abs(checkMinutes - timeToMinutes(shift.start))
    return distance < best.distance ? { shift, distance } : best
  }, { shift: shifts[0], distance: Number.POSITIVE_INFINITY }).shift
}

const evaluateAttendance = (record, settings = DEFAULT_ATTENDANCE_SETTINGS) => {
  if (!record) return null
  const shift = chooseShift(record.checkIn, settings)
  const graceMinutes = parseInt(settings.attendance_grace_minutes, 10) || 0
  const completionBuffer = parseInt(settings.attendance_completion_buffer_minutes, 10) || 0
  const shiftMinutes = minutesBetween(shift.start, shift.end)
  const checkInMinutes = record.checkIn ? timeToMinutes(record.checkIn) : null
  const checkOutMinutes = record.checkOut ? timeToMinutes(record.checkOut) : null
  const startMinutes = timeToMinutes(shift.start)
  const endMinutes = timeToMinutes(shift.end)
  const lateMinutes = checkInMinutes === null ? 0 : Math.max(0, checkInMinutes - startMinutes - graceMinutes)
  const earlyLeaveMinutes = checkOutMinutes === null ? 0 : Math.max(0, endMinutes - checkOutMinutes)
  const workedMinutes = record.checkIn && record.checkOut
    ? minutesBetween(record.checkIn, record.checkOut)
    : Math.round((Number(record.hours || 0)) * 60)
  const completedShift = Boolean(record.checkOut) && workedMinutes >= Math.max(0, shiftMinutes - completionBuffer)
  const shiftResult = !record.checkIn
    ? 'No Check In'
    : !record.checkOut
      ? 'In Progress'
      : completedShift
        ? 'Completed Shift'
        : earlyLeaveMinutes > 0
          ? `Left Early by ${earlyLeaveMinutes} min`
          : 'Incomplete Shift'
  const status = record.status === 'Absent' || record.status === 'On Leave'
    ? record.status
    : lateMinutes > 0
      ? 'Late'
      : record.status || 'Present'

  return {
    shift: shift.name,
    shiftStart: shift.start,
    shiftEnd: shift.end,
    expectedHours: Number((shiftMinutes / 60).toFixed(2)),
    lateMinutes,
    earlyLeaveMinutes,
    workedMinutes,
    completedShift,
    shiftResult,
    status,
  }
}

module.exports = {
  DEFAULT_ATTENDANCE_SETTINGS,
  evaluateAttendance,
  loadAttendanceSettings,
  timeToMinutes,
}
