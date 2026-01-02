/**
 * Seed E2E Test Users
 *
 * Creates or updates test users for E2E testing.
 * Run with: npx ts-node scripts/seed-e2e-users.ts
 *
 * These users are used by the E2E test suite in ../e2e/
 */

import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcrypt';

const E2E_TEST_USERS = [
  {
    email: 'test@intellifill.local',
    password: 'Test123!@#',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER' as const,
  },
  {
    email: 'admin@intellifill.local',
    password: 'Admin123!@#',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN' as const,
  },
];

async function seedE2EUsers() {
  console.log('🧪 Seeding E2E test users...\n');

  for (const userData of E2E_TEST_USERS) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        password: hashedPassword,
        role: userData.role,
        emailVerified: true,
        isActive: true,
      },
      create: {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        emailVerified: true,
        isActive: true,
      },
    });

    console.log(`✅ ${userData.role.padEnd(5)} ${userData.email} (${user.id})`);
  }

  console.log('\n📋 E2E Test Credentials:\n');
  console.log('┌───────────────────────────┬──────────────┬───────┐');
  console.log('│ Email                     │ Password     │ Role  │');
  console.log('├───────────────────────────┼──────────────┼───────┤');
  E2E_TEST_USERS.forEach((user) => {
    console.log(
      `│ ${user.email.padEnd(25)} │ ${user.password.padEnd(12)} │ ${user.role.padEnd(5)} │`
    );
  });
  console.log('└───────────────────────────┴──────────────┴───────┘');

  console.log('\n💡 Run E2E tests with:');
  console.log('   cd ../e2e && npm run test:local\n');

  await prisma.$disconnect();
}

seedE2EUsers().catch((error) => {
  console.error('❌ Error seeding E2E users:', error);
  process.exit(1);
});
