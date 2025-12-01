import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcrypt';

/**
 * Creates test user accounts for development
 * Run with: npx ts-node scripts/create-test-users.ts
 */

async function createTestUsers() {
  console.log('🔧 Creating test user accounts...\n');

  const testUsers = [
    {
      email: 'admin@test.com',
      password: 'Admin123!',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN' as const,
      emailVerified: true,
    },
    {
      email: 'user@test.com',
      password: 'User123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER' as const,
      emailVerified: true,
    },
    {
      email: 'viewer@test.com',
      password: 'Viewer123!',
      firstName: 'Viewer',
      lastName: 'User',
      role: 'VIEWER' as const,
      emailVerified: true,
    },
  ];

  const createdUsers = [];

  for (const userData of testUsers) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists (ID: ${existingUser.id})`);
        createdUsers.push({
          email: userData.email,
          password: userData.password,
          role: existingUser.role,
          existed: true,
        });
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          emailVerified: userData.emailVerified,
          isActive: true,
        },
      });

      console.log(`✅ Created ${userData.role} user: ${userData.email} (ID: ${user.id})`);
      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: user.role,
        existed: false,
      });
    } catch (error) {
      console.error(`❌ Failed to create user ${userData.email}:`, error);
    }
  }

  console.log('\n📋 Test User Credentials:\n');
  console.log('┌─────────────────────┬──────────────┬──────────┐');
  console.log('│ Email               │ Password     │ Role     │');
  console.log('├─────────────────────┼──────────────┼──────────┤');
  createdUsers.forEach((user) => {
    const status = user.existed ? ' (existing)' : '';
    console.log(
      `│ ${user.email.padEnd(19)} │ ${user.password.padEnd(12)} │ ${user.role.padEnd(8)} │${status}`
    );
  });
  console.log('└─────────────────────┴──────────────┴──────────┘');

  console.log('\n💡 Use these credentials to sign in to the application.');
  console.log('🌐 Frontend: http://localhost:8080');
  console.log('🔌 Backend: http://localhost:3002\n');

  await prisma.$disconnect();
}

createTestUsers()
  .catch((error) => {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  });
