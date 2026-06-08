const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const today = '2026-06-04'

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

const employees = [
  {
    id: 'E001', roleAccess: 'admin', password: 'admin123',
    name: 'Anuradha Wijesinghe', email: 'admin@fuchsius.lk', phone: '+94 77 100 1001',
    dept: 'IT', title: 'System Administrator', salary: 350000, joined: '2023-01-10',
    address: 'Colombo 05', emergencyName: 'Malini Wijesinghe',
  },
  {
    id: 'E002', roleAccess: 'hr', password: 'hr123456',
    name: 'Nirmala Perera', email: 'nirmala.perera@fuchsius.lk', phone: '+94 77 100 1002',
    dept: 'Human Resources', title: 'HR Manager', salary: 300000, joined: '2023-03-15',
    address: 'Nugegoda', emergencyName: 'Saman Perera',
  },
  {
    id: 'E003', roleAccess: 'manager', password: 'manager123',
    name: 'Kasun Silva', email: 'kasun.silva@fuchsius.lk', phone: '+94 77 100 1003',
    dept: 'Engineering', title: 'Engineering Lead', salary: 450000, joined: '2022-11-01',
    address: 'Rajagiriya', emergencyName: 'Dinuka Silva',
  },
  {
    id: 'E004', roleAccess: 'manager', password: 'manager234',
    name: 'Tharindu Fernando', email: 'tharindu.fernando@fuchsius.lk', phone: '+94 77 100 1004',
    dept: 'Customer Success', title: 'Customer Success Lead', salary: 380000, joined: '2022-08-18',
    address: 'Wattala', emergencyName: 'Iresha Fernando',
  },
  {
    id: 'E005', roleAccess: 'employee', password: 'emp123456',
    name: 'Dilini Jayawardena', email: 'dilini.jayawardena@fuchsius.lk', phone: '+94 77 100 1005',
    dept: 'Engineering', title: 'Frontend Engineer', salary: 250000, joined: '2024-02-12',
    manager: 'Kasun Silva', managerId: 'E003', address: 'Kottawa', emergencyName: 'Chamari Jayawardena',
  },
  {
    id: 'E006', roleAccess: 'employee', password: 'emp123456',
    name: 'Chamodi Bandara', email: 'chamodi.bandara@fuchsius.lk', phone: '+94 77 100 1006',
    dept: 'Engineering', title: 'QA Engineer', salary: 220000, joined: '2024-04-08',
    manager: 'Kasun Silva', managerId: 'E003', address: 'Maharagama', emergencyName: 'Nadeeka Bandara',
  },
  {
    id: 'E007', roleAccess: 'employee', password: 'emp123456',
    name: 'Isuru Rathnayake', email: 'isuru.rathnayake@fuchsius.lk', phone: '+94 77 100 1007',
    dept: 'Engineering', title: 'Backend Engineer', salary: 280000, joined: '2023-09-20',
    manager: 'Kasun Silva', managerId: 'E003', address: 'Gampaha', emergencyName: 'Sanduni Rathnayake',
  },
  {
    id: 'E008', roleAccess: 'employee', password: 'emp123456',
    name: 'Sadeesha Senanayake', email: 'sadeesha.senanayake@fuchsius.lk', phone: '+94 77 100 1008',
    dept: 'Engineering', title: 'UI Designer', salary: 210000, joined: '2025-01-06',
    manager: 'Kasun Silva', managerId: 'E003', address: 'Piliyandala', emergencyName: 'Dulani Senanayake',
  },
  {
    id: 'E009', roleAccess: 'employee', password: 'emp123456',
    name: 'Lahiru Madushanka', email: 'lahiru.madushanka@fuchsius.lk', phone: '+94 77 100 1009',
    dept: 'Customer Success', title: 'Support Executive', salary: 180000, joined: '2025-03-10',
    manager: 'Tharindu Fernando', managerId: 'E004', address: 'Negombo', emergencyName: 'Manori Madushanka',
  },
  {
    id: 'E010', roleAccess: 'employee', password: 'emp123456',
    name: 'Kavindi Herath', email: 'kavindi.herath@fuchsius.lk', phone: '+94 77 100 1010',
    dept: 'Human Resources', title: 'HR Assistant', salary: 190000, joined: '2024-10-14',
    manager: 'Nirmala Perera', managerId: 'E002', address: 'Kadawatha', emergencyName: 'Ruwan Herath',
  },
]

async function createEmployeeRecord(employee) {
  const hashed = await bcrypt.hash(employee.password, 10)
  const user = await prisma.user.create({
    data: {
      id: `u${employee.id.slice(1).padStart(3, '0')}`,
      name: employee.name,
      email: employee.email,
      password: hashed,
      role: employee.roleAccess,
      dept: employee.dept,
      title: employee.title,
      status: 'Active',
    },
  })

  return prisma.employee.create({
    data: {
      id: employee.id,
      userId: user.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      dept: employee.dept,
      role: employee.title,
      manager: employee.manager || null,
      managerId: employee.managerId || null,
      salary: employee.salary,
      joined: employee.joined,
      status: 'Active',
      leaveBalance: employee.roleAccess === 'admin' ? 18 : 14,
      employmentType: 'Full-time',
      address: employee.address,
      emergencyName: employee.emergencyName,
      emergencyPhone: '+94 77 555 0101',
      emergencyRel: 'Family',
    },
  })
}

async function seedPayroll(employee) {
  const monthly = Math.round(employee.salary)
  const housing = Math.round(monthly * 0.12)
  const transport = Math.round(monthly * 0.06)
  const medical = Math.round(monthly * 0.03)
  const gross = monthly + housing + transport + medical
  const tax = Math.round(gross * 0.12)
  const recurringDeductions = Math.round(gross * 0.05)
  const net = gross - tax - recurringDeductions

  await prisma.compensationStructure.create({
    data: {
      employeeId: employee.id,
      basicSalary: monthly,
      housingAllowance: housing,
      transportAllowance: transport,
      medicalAllowance: medical,
      recurringDeductions,
      bankName: 'Commercial Bank of Ceylon',
      bankAccount: `7050${employee.id.replace('E', '').padStart(6, '0')}`,
    },
  })

  for (const month of ['April 2026', 'May 2026', 'June 2026']) {
    const isMay = month === 'May 2026'
    const isJune = month === 'June 2026'
    const overtime = isMay ? 18000 : isJune ? 12000 : 0
    const bonus = employee.id === 'E005' && isMay ? 45000 : 0
    const reimbursements = isMay ? 8000 : isJune ? 5000 : 0
    const attendanceUnpaidDays = employee.id === 'E005' && isJune ? 1.05 : employee.id === 'E006' && isJune ? 1 : 0
    const attendanceDeduction = Math.round((monthly / 22) * attendanceUnpaidDays)
    const grossTotal = gross + overtime + bonus + reimbursements
    const deductionsTotal = tax + recurringDeductions + attendanceDeduction

    await prisma.payrollRecord.create({
      data: {
        employeeId: employee.id,
        month,
        currency: 'LKR',
        basic: monthly,
        allowances: housing + transport + medical,
        overtime,
        bonus,
        reimbursements,
        unpaidLeaveDeduction: attendanceDeduction,
        recurringDeductions,
        oneTimeDeductions: 0,
        gross: grossTotal,
        deductions: deductionsTotal,
        tax,
        net: grossTotal - deductionsTotal,
        status: isJune ? 'Draft' : 'Paid',
        approvedBy: isJune ? null : 'Nirmala Perera',
        approvedOn: isJune ? null : isMay ? '2026-05-28' : '2026-04-28',
        paidOn: isJune ? null : isMay ? '2026-05-30' : '2026-04-30',
      },
    })
  }
}

async function main() {
  console.log('Seeding Fuchsius HRMS Sri Lanka demo database...')
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

  const departments = [
    { name: 'Engineering', head: 'Kasun Silva', budget: 32000000 },
    { name: 'Human Resources', head: 'Nirmala Perera', budget: 12000000 },
    { name: 'IT', head: 'Anuradha Wijesinghe', budget: 8500000 },
    { name: 'Customer Success', head: 'Tharindu Fernando', budget: 14000000 },
  ]
  for (const department of departments) await prisma.department.create({ data: department })

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

  const holidays = [
    { date: '2026-01-03', name: 'Duruthu Full Moon Poya Day' },
    { date: '2026-01-14', name: 'Tamil Thai Pongal Day' },
    { date: '2026-02-01', name: 'Navam Full Moon Poya Day' },
    { date: '2026-02-04', name: 'Independence Day' },
    { date: '2026-02-15', name: 'Mahasivarathri Day' },
    { date: '2026-03-02', name: 'Medin Full Moon Poya Day' },
    { date: '2026-03-21', name: 'Id-Ul-Fitre (Ramazan Festival Day)' },
    { date: '2026-04-01', name: 'Bak Full Moon Poya Day' },
    { date: '2026-04-03', name: 'Good Friday' },
    { date: '2026-04-13', name: 'Sinhala and Tamil New Year Eve' },
    { date: '2026-04-14', name: 'Sinhala and Tamil New Year Day' },
    { date: '2026-05-01', name: 'Vesak Full Moon Poya Day / May Day' },
    { date: '2026-05-02', name: 'Day following Vesak Full Moon Poya Day' },
    { date: '2026-05-28', name: 'Id-Ul-Allah (Hadji Festival Day)' },
    { date: '2026-05-30', name: 'Adhi Poson Full Moon Poya Day' },
    { date: '2026-06-29', name: 'Poson Full Moon Poya Day' },
    { date: '2026-07-29', name: 'Esala Full Moon Poya Day' },
    { date: '2026-08-26', name: "Milad-Un-Nabi (Holy Prophet's Birthday)" },
    { date: '2026-08-27', name: 'Nikini Full Moon Poya Day' },
    { date: '2026-09-26', name: 'Binara Full Moon Poya Day' },
    { date: '2026-10-25', name: 'Vap Full Moon Poya Day' },
    { date: '2026-11-08', name: 'Deepawali Festival Day' },
    { date: '2026-11-24', name: 'Ill Full Moon Poya Day' },
    { date: '2026-12-23', name: 'Unduwap Full Moon Poya Day' },
    { date: '2026-12-25', name: 'Christmas Day' },
  ]
  for (const holiday of holidays) await prisma.holiday.create({ data: holiday })

  for (const employee of employees) await createEmployeeRecord(employee)

  for (const employee of employees.filter(item => item.salary > 0)) await seedPayroll(employee)

  const attendanceDates = ['2026-06-01', '2026-06-02', '2026-06-03', today]
  for (const employee of employees.slice(1)) {
    for (const date of attendanceDates) {
      const isDiliniLate = employee.id === 'E005' && date === '2026-06-03'
      const isChamodiAbsent = employee.id === 'E006' && date === '2026-06-02'
      await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date,
          checkIn: isChamodiAbsent ? null : isDiliniLate ? '09:28' : '08:55',
          checkOut: isChamodiAbsent ? null : date === today ? null : '17:35',
          hours: isChamodiAbsent || date === today ? 0 : 8.5,
          status: isChamodiAbsent ? 'Absent' : isDiliniLate ? 'Late' : 'Present',
        },
      })
    }
  }

  await prisma.leaveRequest.createMany({
    data: [
      { employeeId: 'E005', type: 'Personal', start: '2026-06-10', end: '2026-06-10', days: 1, status: 'Approved', reason: 'Family bank appointment', decisionNote: 'Approved for payroll deduction demo', decidedBy: 'Nirmala Perera', decidedOn: '2026-06-03', appliedOn: '2026-06-02' },
      { employeeId: 'E010', type: 'Sick Leave', start: '2026-06-12', end: '2026-06-12', days: 1, status: 'Pending HR', reason: 'Medical appointment', decisionNote: 'Manager approved', decidedBy: 'Nirmala Perera', decidedOn: '2026-06-06', appliedOn: '2026-06-05' },
    ],
  })

  const cycle = await prisma.performanceCycle.create({
    data: { name: 'Q2 2026 Growth Review', type: 'Quarterly Review', dept: 'All Departments', startDate: '2026-04-01', endDate: '2026-06-30', status: 'In Progress' },
  })

  for (const employee of employees.filter(item => item.roleAccess === 'employee')) {
    await prisma.performanceReview.create({
      data: {
        employeeId: employee.id,
        period: cycle.name,
        rating: employee.id === 'E005' ? 4.6 : null,
        goals: 4,
        completed: employee.id === 'E005' ? 3 : 2,
        status: employee.id === 'E005' ? 'Manager Reviewed' : 'In Progress',
        reviewer: employee.manager,
        selfReview: 'Progressing well on agreed quarterly deliverables.',
        managerFeedback: employee.id === 'E005' ? 'Strong delivery on the HRMS attendance and payroll screens.' : null,
      },
    })
    await prisma.goal.createMany({
      data: [
        { employeeId: employee.id, title: 'Improve team workflow visibility', due: '2026-06-28', progress: employee.id === 'E005' ? 80 : 45, status: employee.id === 'E005' ? 'On Track' : 'At Risk' },
        { employeeId: employee.id, title: 'Document one reusable process', due: '2026-06-30', progress: 60, status: 'On Track' },
      ],
    })
  }

  const job = await prisma.jobOpening.create({
    data: {
      title: 'QA Automation Engineer',
      dept: 'Engineering',
      type: 'Full-time',
      location: 'Hybrid',
      posted: '2026-05-20',
      applicants: 3,
      status: 'Active',
      description: 'Own test automation for Fuchsius HRMS web workflows.',
      minSalary: 200000,
      maxSalary: 300000,
    },
  })
  await prisma.candidate.createMany({
    data: [
      { name: 'Sachini Liyanage', email: 'sachini.liyanage@email.com', phone: '+94 77 210 3030', jobId: job.id, stage: 'Interview', status: 'In Progress', applied: '2026-05-22', rating: 4, notes: 'Good Cypress and Playwright experience.' },
      { name: 'Hirun Madushanka', email: 'hirun.madushanka@email.com', phone: '+94 77 220 4040', jobId: job.id, stage: 'Screening', status: 'In Progress', applied: '2026-05-25', rating: 3, notes: 'Needs HR phone screen.' },
    ],
  })

  await prisma.document.createMany({
    data: [
      { employeeId: 'E005', name: 'NIC Copy.pdf', category: 'Identity', uploadedBy: 'Nirmala Perera', uploadedOn: '2026-05-01', status: 'Verified' },
      { employeeId: 'E005', name: 'May 2026 Payslip', category: 'Payroll', uploadedBy: 'Nirmala Perera', uploadedOn: '2026-05-30', status: 'Verified' },
      { employeeId: 'E006', name: 'Employment Contract.pdf', category: 'Contract', uploadedBy: 'Nirmala Perera', uploadedOn: '2026-04-10', status: 'Verified' },
      { employeeId: 'E009', name: 'Training Certificate.pdf', category: 'Certificate', uploadedBy: 'Tharindu Fernando', uploadedOn: '2026-05-18', status: 'Pending' },
    ],
  })

  await prisma.notification.createMany({
    data: [
      { type: 'system', msg: 'Welcome to Fuchsius HRMS. Sri Lanka demo data is ready.', path: '/admin', audience: 'admin,hr' },
      { type: 'leave', msg: 'Kavindi Herath sick leave request needs HR final approval', path: '/hr/leave', audience: 'hr,admin' },
      { type: 'attendance', msg: 'June payroll includes approved leave and absence deductions for demo review', path: '/hr/payroll', audience: 'hr,admin' },
      { type: 'payroll', msg: 'May 2026 LKR payslips are available', path: '/employee/payroll', audience: 'employee' },
    ],
  })

  await prisma.auditLog.create({
    data: { userId: 'u001', action: 'SEED_DATABASE', module: 'System', detail: 'Loaded Fuchsius Sri Lanka HRMS sample data', ip: 'seed' },
  })

  console.log('Seed complete.')
  console.log('')
  console.log('Useful test logins:')
  console.log('  Admin    -> admin@fuchsius.lk / admin123')
  console.log('  HR       -> nirmala.perera@fuchsius.lk / hr123456')
  console.log('  Manager  -> kasun.silva@fuchsius.lk / manager123')
  console.log('  Manager2 -> tharindu.fernando@fuchsius.lk / manager234')
  console.log('  Employee -> dilini.jayawardena@fuchsius.lk / emp123456')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
