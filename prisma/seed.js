const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const employeeHash = await bcrypt.hash('1234', 10);
  const superAdminHash = await bcrypt.hash('8888', 10);

  const superAdmin = await prisma.employee.upsert({
    where: { id: 'seed-superadmin-1' },
    create: {
      id: 'seed-superadmin-1',
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      passcode: { create: { passcodeHash: superAdminHash } },
    },
    update: {},
    include: { passcode: true },
  });
  if (!superAdmin.passcode) {
    await prisma.employeePasscode.upsert({
      where: { employeeId: superAdmin.id },
      create: { employeeId: superAdmin.id, passcodeHash: superAdminHash },
      update: { passcodeHash: superAdminHash },
    });
  }

  const employee = await prisma.employee.upsert({
    where: { id: 'seed-employee-1' },
    create: {
      id: 'seed-employee-1',
      name: 'Alice',
      role: 'EMPLOYEE',
      isActive: true,
      passcode: { create: { passcodeHash: employeeHash } },
    },
    update: {},
    include: { passcode: true },
  });
  if (!employee.passcode) {
    await prisma.employeePasscode.upsert({
      where: { employeeId: employee.id },
      create: { employeeId: employee.id, passcodeHash: employeeHash },
      update: { passcodeHash: employeeHash },
    });
  }

  console.log('Seed: SUPER_ADMIN passcode 8888; EMPLOYEE passcode 1234');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
