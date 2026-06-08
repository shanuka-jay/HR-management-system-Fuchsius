const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function clearDatabase() {
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.document.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.performanceReview.deleteMany()
  await prisma.performanceCycle.deleteMany()
  await prisma.candidate.deleteMany()
  await prisma.jobOpening.deleteMany()
  await prisma.payrollVariable.deleteMany()
  await prisma.compensationStructure.deleteMany()
  await prisma.payrollRecord.deleteMany()
  await prisma.payrollSetting.deleteMany()
  await prisma.attendanceCorrection.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.leaveRequest.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.user.deleteMany()
  await prisma.department.deleteMany()
  await prisma.holiday.deleteMany()
  await prisma.setting.deleteMany()
}

async function main() {
  console.log('Seeding Fuchsius HRMS fresh-start database...')
  await clearDatabase()

  await prisma.payrollSetting.create({
    data: {
      id: 'default',
      currency: 'LKR',
      payPeriod: 'Monthly',
      taxRate: 0.12,
      standardDeductionRate: 0.05,
      overtimeMultiplier: 1.5,
      unpaidLeaveDailyDivisor: 22,
    },
  })

  const settings = [
    { key: 'company_name', value: 'Fuchsius' },
    { key: 'company_email', value: 'hr@fuchsius.lk' },
    { key: 'company_phone', value: '+94 11 245 7788' },
    { key: 'company_website', value: 'https://fuchsius.lk' },
    { key: 'timezone', value: 'Asia/Colombo' },
    { key: 'date_format', value: 'YYYY-MM-DD' },
    { key: 'currency', value: 'LKR' },
    { key: 'work_hours_per_day', value: '8' },
    { key: 'attendance_shift1_name', value: 'Morning Shift' },
    { key: 'attendance_shift1_start', value: '09:00' },
    { key: 'attendance_shift1_end', value: '17:00' },
    { key: 'attendance_shift2_name', value: 'Evening Shift' },
    { key: 'attendance_shift2_start', value: '13:00' },
    { key: 'attendance_shift2_end', value: '21:00' },
    { key: 'attendance_grace_minutes', value: '5' },
    { key: 'attendance_completion_buffer_minutes', value: '15' },
    { key: 'leave_year_reset', value: 'January 1' },
    { key: 'password_min_length', value: '8' },
    { key: 'tax_rate', value: '12' },
    { key: 'payroll_period', value: 'Monthly' },
  ]
  for (const setting of settings) await prisma.setting.create({ data: setting })

  await prisma.department.create({ data: { name: 'IT', head: 'Anuradha Wijesinghe', budget: 0 } })

  const password = 'admin123'
  const hashed = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: {
      id: 'u001',
      name: 'Anuradha Wijesinghe',
      email: 'admin@fuchsius.lk',
      password: hashed,
      role: 'admin',
      dept: 'IT',
      title: 'System Administrator',
      status: 'Active',
    },
  })

  await prisma.employee.create({
    data: {
      id: 'E001',
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: '+94 77 100 1001',
      dept: 'IT',
      role: 'System Administrator',
      salary: 350000,
      joined: '2026-01-01',
      status: 'Active',
      leaveBalance: 18,
      employmentType: 'Full-time',
      address: 'Colombo 05',
      emergencyName: 'Malini Wijesinghe',
      emergencyPhone: '+94 77 555 0101',
      emergencyRel: 'Family',
    },
  })

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'SEED_FRESH_DATABASE', module: 'System', detail: 'Created fresh-start admin database', ip: 'seed' },
  })

  console.log('Fresh-start seed complete.')
  console.log('')
  console.log('Admin login:')
  console.log(`  Admin -> ${user.email} / ${password}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
