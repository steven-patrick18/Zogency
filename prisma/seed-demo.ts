// Demo dataset: 25-employee BRB Digital org with full reporting hierarchy.
//   npx tsx prisma/seed-demo.ts
// Idempotent — upserts by email; safe to re-run. All demo logins: Demo@123
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

type Person = {
  name: string
  email: string
  designation: string
  department: string | null // department name (null = leadership w/o board)
  managerEmail: string | null // reporting manager (null = top)
  roles: string[]
  isDeptHead?: boolean
}

// ── The org chart ────────────────────────────────────────────────────────────
// L1 Founder → L2 function managers → L3 dept heads / reps → L4 executives
const ORG: Person[] = [
  { name: 'Arvind Mehta', email: 'admin@brb.digital', designation: 'Founder & CEO', department: 'Management', managerEmail: null, roles: ['Admin'] },

  // L2 — function managers (report to Arvind)
  { name: 'Faizal Ansari', email: 'faizal@brb.digital', designation: 'Marketing Manager', department: 'Management', managerEmail: 'admin@brb.digital', roles: ['Admin', 'Marketing Manager', 'Creative'] },
  { name: 'Vikram Singh', email: 'vikram.singh@brb.digital', designation: 'Sales Manager', department: 'Sales', managerEmail: 'admin@brb.digital', roles: ['Sales Manager'], isDeptHead: true },
  { name: 'Meera Iyer', email: 'meera.iyer@brb.digital', designation: 'HR Manager', department: 'HR & Admin', managerEmail: 'admin@brb.digital', roles: ['HR Manager'], isDeptHead: true },
  { name: 'Rajesh Gupta', email: 'rajesh.gupta@brb.digital', designation: 'Finance Manager', department: 'Finance', managerEmail: 'admin@brb.digital', roles: ['Finance'], isDeptHead: true },
  { name: 'Sneha Kulkarni', email: 'sneha.kulkarni@brb.digital', designation: 'Delivery Head', department: 'Management', managerEmail: 'admin@brb.digital', roles: ['Delivery', 'Account Servicing'] },

  // L3 — sales team (report to Vikram)
  { name: 'Arjun Rao', email: 'arjun.rao@brb.digital', designation: 'Business Development Executive', department: 'Sales', managerEmail: 'vikram.singh@brb.digital', roles: ['Sales Rep'] },
  { name: 'Pooja Patel', email: 'pooja.patel@brb.digital', designation: 'Business Development Executive', department: 'Sales', managerEmail: 'vikram.singh@brb.digital', roles: ['Sales Rep'] },
  { name: 'Imran Sheikh', email: 'imran.sheikh@brb.digital', designation: 'Telecaller', department: 'Sales', managerEmail: 'vikram.singh@brb.digital', roles: ['Sales Rep'] },

  // L3 — strategy (reports to Faizal)
  { name: 'Ananya Krishnan', email: 'ananya.krishnan@brb.digital', designation: 'Strategy Lead', department: 'Management', managerEmail: 'faizal@brb.digital', roles: ['Account Servicing', 'Marketing Manager'] },

  // L3 — department heads (report to Faizal) + L4 executives (report to their head)
  { name: 'Rohit Malhotra', email: 'rohit.malhotra@brb.digital', designation: 'SEO Head', department: 'SEO', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Divya Menon', email: 'divya.menon@brb.digital', designation: 'SEO Executive', department: 'SEO', managerEmail: 'rohit.malhotra@brb.digital', roles: ['Creative'] },

  { name: 'Neha Kapoor', email: 'neha.kapoor@brb.digital', designation: 'Design Head', department: 'Design', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Karan Joshi', email: 'karan.joshi@brb.digital', designation: 'Senior Designer', department: 'Design', managerEmail: 'neha.kapoor@brb.digital', roles: ['Creative'] },
  { name: 'Priyanka Das', email: 'priyanka.das@brb.digital', designation: 'Graphic Designer', department: 'Design', managerEmail: 'neha.kapoor@brb.digital', roles: ['Creative'] },

  { name: 'Aditya Verma', email: 'aditya.verma@brb.digital', designation: 'Social Media Head', department: 'Social', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Ritika Shah', email: 'ritika.shah@brb.digital', designation: 'Social Media Executive', department: 'Social', managerEmail: 'aditya.verma@brb.digital', roles: ['Creative'] },

  { name: 'Sameer Khan', email: 'sameer.khan@brb.digital', designation: 'Video Production Head', department: 'Video', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Lakshmi Pillai', email: 'lakshmi.pillai@brb.digital', designation: 'Video Editor', department: 'Video', managerEmail: 'sameer.khan@brb.digital', roles: ['Creative'] },

  { name: 'Ishita Banerjee', email: 'ishita.banerjee@brb.digital', designation: 'Content Head', department: 'Content', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Nikhil Kumar', email: 'nikhil.kumar@brb.digital', designation: 'Content Writer', department: 'Content', managerEmail: 'ishita.banerjee@brb.digital', roles: ['Creative'] },

  { name: 'Deepak Nair', email: 'deepak.nair@brb.digital', designation: 'Web Development Head', department: 'Web', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Tanvi Joshi', email: 'tanvi.joshi@brb.digital', designation: 'Web Developer', department: 'Web', managerEmail: 'deepak.nair@brb.digital', roles: ['Creative'] },

  { name: 'Gaurav Mehra', email: 'gaurav.mehra@brb.digital', designation: 'Performance Marketing Head', department: 'Performance', managerEmail: 'faizal@brb.digital', roles: ['Creative', 'Delivery'], isDeptHead: true },
  { name: 'Shruti Agarwal', email: 'shruti.agarwal@brb.digital', designation: 'Performance Marketing Analyst', department: 'Performance', managerEmail: 'gaurav.mehra@brb.digital', roles: ['Creative'] },
]

const EXTRA_DEPARTMENTS = ['Sales', 'HR & Admin', 'Finance', 'Management']

async function main() {
  // Single-tenant installs: fall back to the only tenant regardless of slug.
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'brb' } })) ??
    (await prisma.tenant.findFirstOrThrow())
  const tenantId = tenant.id

  // Departments beyond the 7 delivery boards (tenant-configurable per Q12).
  const maxSort = (await prisma.department.count({ where: { tenantId } })) + 1
  for (const [i, name] of EXTRA_DEPARTMENTS.entries()) {
    await prisma.department.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, type: name.toLowerCase().replace(/[^a-z]+/g, '_'), sort: maxSort + i },
    })
  }
  const departments = new Map(
    (await prisma.department.findMany({ where: { tenantId } })).map((d) => [d.name, d]),
  )
  const roles = new Map(
    (await prisma.role.findMany({ where: { tenantId } })).map((r) => [r.name, r]),
  )
  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId } })
  const passwordHash = await bcrypt.hash('Demo@123', 12)
  const year = new Date().getFullYear()

  // Pass 1 — users + roles
  const userIdByEmail = new Map<string, string>()
  for (const person of ORG) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: person.email } },
      update: { name: person.name },
      create: { tenantId, name: person.name, email: person.email, passwordHash },
    })
    userIdByEmail.set(person.email, user.id)
    for (const roleName of person.roles) {
      const role = roles.get(roleName)
      if (!role) continue
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      })
    }
  }

  // Pass 2 — employee records with the manager chain
  let joinedOffset = 0
  for (const person of ORG) {
    const userId = userIdByEmail.get(person.email)!
    const dept = person.department ? departments.get(person.department) : null
    const managerId = person.managerEmail ? userIdByEmail.get(person.managerEmail)! : null
    // Staggered joining dates: founder earliest, executives latest.
    const joinedOn = new Date(Date.now() - (900 - joinedOffset * 30) * 86_400_000)
    joinedOffset++

    const employee = await prisma.employee.upsert({
      where: { userId },
      update: { departmentId: dept?.id ?? null, managerId, designation: person.designation, status: 'active' },
      create: {
        tenantId,
        userId,
        departmentId: dept?.id ?? null,
        managerId,
        designation: person.designation,
        joinedOn,
        status: 'active',
      },
    })
    if (person.isDeptHead && dept) {
      await prisma.department.update({ where: { id: dept.id }, data: { headUserId: userId } })
    }
    // Leave balances for the current year
    for (const type of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_typeId_year: { tenantId, employeeId: employee.id, typeId: type.id, year } },
        update: {},
        create: { tenantId, employeeId: employee.id, typeId: type.id, year, available: type.annualQuota },
      })
    }
  }

  // Today's attendance for ~2/3 of the team (mix of office and WFH)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const employees = await prisma.employee.findMany({ where: { tenantId, status: 'active' } })
  for (const [i, employee] of employees.entries()) {
    if (i % 3 === 2) continue // a third haven't punched in yet
    const inAt = new Date(today.getTime() + (9 * 60 + (i % 45)) * 60_000) // 9:00–9:45
    await prisma.attendanceRecord.upsert({
      where: { tenantId_employeeId_date: { tenantId, employeeId: employee.id, date: today } },
      update: {},
      create: { tenantId, employeeId: employee.id, date: today, inAt, mode: i % 4 === 0 ? 'wfh' : 'office' },
    })
  }

  // A couple of pending leave requests for the approval queue
  const casual = leaveTypes.find((t) => t.name === 'Casual Leave')
  if (casual) {
    for (const email of ['karan.joshi@brb.digital', 'ritika.shah@brb.digital']) {
      const employee = employees.find((e) => e.userId === userIdByEmail.get(email))
      if (!employee) continue
      const existing = await prisma.leaveRequest.findFirst({
        where: { employeeId: employee.id, state: 'pending' },
      })
      if (!existing) {
        await prisma.leaveRequest.create({
          data: {
            tenantId,
            employeeId: employee.id,
            typeId: casual.id,
            fromOn: new Date(Date.now() + 7 * 86_400_000),
            toOn: new Date(Date.now() + 8 * 86_400_000),
            days: 2,
            reason: 'Family function',
          },
        })
      }
    }
  }

  // A quarterly review cycle
  await prisma.performanceCycle.upsert({
    where: { tenantId_name: { tenantId, name: 'Q3 FY27 Review' } },
    update: {},
    create: {
      tenantId,
      name: 'Q3 FY27 Review',
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-09-30'),
    },
  })

  const counts = {
    employees: await prisma.employee.count({ where: { tenantId, status: 'active' } }),
    users: await prisma.user.count({ where: { tenantId, status: 'active' } }),
    departments: await prisma.department.count({ where: { tenantId } }),
  }
  console.log(`Demo org seeded: ${counts.employees} active employees across ${counts.departments} departments (${counts.users} active users). Demo logins: <email> / Demo@123`)
}

main().finally(() => prisma.$disconnect())
