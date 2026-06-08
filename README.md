# Fuchsius HRMS

Fuchsius HRMS is a full-stack human resource management system for a Sri Lankan company. It uses LKR currency, role-based portals, Sinhala demo employee names, employee self-service, HR operations, payroll, attendance, leave, performance, documents, reports, and admin settings.

The system has four portal roles:

- Admin
- HR
- Manager
- Employee

Each person has one login user and one linked employee record. The login role controls the portal they can access, while the employee record powers attendance, leave, payroll, documents, profile, and performance data.

## Tech Stack

### Frontend

- React 18
- Vite
- React Router
- Tailwind CSS
- Axios
- React Toastify
- Recharts
- Lucide React icons

### Backend

- Node.js
- Express
- Prisma ORM
- SQLite
- JWT authentication
- bcrypt password hashing
- Multer file uploads
- PDFKit payslip generation
- Google ID token verification support

## Project Structure

```txt
FINAL/
  client/
    src/
      api/                 API client and service wrappers
      components/shared/   Shared layout, sidebar, top bar, modals, alerts
      context/             Auth and HR shared state
      hooks/               Current employee and manager team helpers
      pages/               Login pages
      portals/
        admin/             Admin portal pages
        hr/                HR portal pages
        manager/           Manager portal pages
        employee/          Employee self-service pages
      utils/               Shared workflow utilities
  server/
    middleware/            Auth and role guards
    prisma/
      schema.prisma        Database schema
      seed.js              Presentation seed
      seed.presentation.js Presentation seed alias
      seed.admin.js        Fresh-start admin-only seed
    routes/                API modules
    outbox/                Local email fallback files
    uploads/               Runtime uploaded files
    utils/                 Mailer, notifications, attendance rules
```

## Setup

Open two terminals: one for the backend and one for the frontend.

### 1. Backend

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed:presentation
npm run dev
```

The backend runs on:

```txt
http://localhost:5000
```

If port `5000` is already in use on Windows:

```powershell
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F
```

### 2. Frontend

```bash
cd client
npm install
npm run dev
```

The frontend usually runs on:

```txt
http://localhost:5173
```

If Vite chooses another port, use the URL shown in the terminal.

## Environment

Create or update `server/.env`:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="fuchsius_super_secret_key_2026_change_in_prod"
JWT_EXPIRES_IN="30d"
PORT=5000
UPLOAD_DIR="uploads"

GOOGLE_CLIENT_ID=""

APP_URL="http://localhost:5173/login"
MAIL_FROM="Fuchsius HRMS <no-reply@fuchsius.lk>"
MAIL_FROM_ADDRESS="no-reply@fuchsius.lk"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_STARTTLS="true"
SMTP_USER=""
SMTP_PASS=""
```

When `SMTP_HOST` is empty, emails are saved as local files in `server/outbox`. This is useful for testing payslip emails and onboarding messages without a real mail account.

For real Google login, add a valid Google OAuth Client ID to `GOOGLE_CLIENT_ID`. Without that value, use normal email/password login or the demo buttons.

## Seeds

There are two seed modes.

### Fresh Start Seed

Use this when you want a clean system with only one admin account:

```bash
cd server
npm run db:seed:fresh
```

Fresh admin login:

```txt
Email: admin@fuchsius.lk
Password: admin123
```

### Presentation Seed

Use this when you want the system filled with demo data for showing or testing:

```bash
cd server
npm run db:seed:presentation
```

`npm run db:seed` also runs the presentation seed.

Presentation data includes 10 staff:

- 1 Admin
- 1 HR
- 2 Managers
- 6 Employees

Demo logins:

```txt
Admin    -> admin@fuchsius.lk / admin123
HR       -> nirmala.perera@fuchsius.lk / hr123456
Manager  -> kasun.silva@fuchsius.lk / manager123
Manager2 -> tharindu.fernando@fuchsius.lk / manager234
Employee -> dilini.jayawardena@fuchsius.lk / emp123456
```

The login page also has demo account buttons for faster testing.

## Main Workflows

### Admin

Admin manages the system setup.

- Manage users and role access.
- Manage organization settings.
- Configure attendance shift settings.
- View audit logs and global notifications.
- Use My Workspace for the admin's own attendance, leave, payroll, profile, and performance.

### HR

HR manages workforce operations.

- Add and manage employees.
- Manage recruitment, documents, attendance, leave, payroll, performance, and reports.
- Review payroll drafts.
- Approve payroll one by one or approve all drafts.
- Mark approved payroll records as paid one by one or pay all approved.
- Email payslips with PDF attachment support.
- Use My Workspace for HR self-service.

### Manager

Managers manage direct reports.

- View team members.
- Review team attendance.
- Review or approve team leave where the workflow requires manager input.
- Manage team performance reviews.
- Use My Workspace for their own employee self-service.

### Employee

Employees use self-service.

- Check in and check out.
- View attendance history and shift result.
- Apply for leave.
- View payroll and payslips.
- Receive payroll notifications after payment.
- Manage profile, documents, goals, and performance self-review data.

## Payroll Logic

Salary is monthly salary in LKR.

Payroll uses:

- Monthly basic salary
- Allowances
- Manual payroll inputs
- Deductions
- Tax
- Attendance impact
- Leave impact

Attendance and leave deduction rules:

- Recorded absent days are deducted.
- Approved leave days are deducted when they are unpaid or part of the payroll deduction calculation.
- Late arrival and early checkout minutes are converted into a partial unpaid-day deduction.
- Manual unpaid days can still be entered by HR.
- Payroll keeps the attendance impact visible so HR can review it before approval.

Typical payroll flow:

```txt
Draft -> HR Review -> Approve -> Pay -> Notify Employee -> Email Payslip PDF
```

## Attendance Logic

Attendance supports shift-based evaluation.

- Admin can configure organization start time and off time.
- The system supports two shifts, including a night shift.
- Late arrivals are calculated after the configured grace period.
- Early checkout is calculated against shift end time.
- After checkout, the system shows whether the shift was completed, short, late, or affected by early leave.
- Attendance reports can be filtered by date range and shift.

## Reports

Reports include filters where they are useful for understanding data clearly.

- Attendance reports can be filtered by date range and shift.
- Payroll reports can be filtered by month, status, department, and role.
- Leave reports can be filtered by status, department, and date range.
- Performance reports can be filtered by review cycle, status, department, and reviewer.

## Email And Payslips

If SMTP is configured, the system sends real emails.

If SMTP is not configured, the system writes email files into:

```txt
server/outbox
```

Payslip emails include a message and generated PDF attachment data. This allows you to test the workflow before adding real SMTP credentials.

## Google Login

Google login is designed to work like a real login.

- The frontend receives a Google ID token.
- The backend verifies it using `GOOGLE_CLIENT_ID`.
- The verified Google email must match an existing user email.
- If the email is not registered in Fuchsius HRMS, login is rejected.

## Production Checklist

Before real production use:

- Change `JWT_SECRET`.
- Configure real SMTP credentials.
- Configure a real Google OAuth Client ID if Google login is needed.
- Use PostgreSQL or MySQL instead of SQLite.
- Add HTTPS.
- Review file upload storage and backups.
- Review payroll tax and statutory deduction rules with the company accountant.
- Remove demo login buttons before live deployment.

## Build

Frontend production build:

```bash
cd client
npm run build
```

Backend start without nodemon:

```bash
cd server
npm start
```
