import dotenv from 'dotenv';
dotenv.config(); // Load environment variables first

import { supabaseAdmin } from '../src/utils/supabase';
import { prisma } from '../src/utils/prisma';
import { logger } from '../src/utils/logger';

/**
 * Creates test user accounts via Supabase Auth + Prisma
 * This properly registers users through the Supabase authentication system
 *
 * Run with: npx ts-node scripts/create-test-users-supabase.ts
 */

interface TestUser {
  email: string;
  password: string;
  fullName: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
}

async function createTestUsers() {
  console.log('🔧 Creating test user accounts via Supabase Auth...\n');

  const testUsers: TestUser[] = [
    {
      email: 'admin@test.com',
      password: 'Admin123!',
      fullName: 'Admin User',
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
    {
      email: 'user@test.com',
      password: 'User123!',
      fullName: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
    },
    {
      email: 'viewer@test.com',
      password: 'Viewer123!',
      fullName: 'Viewer User',
      firstName: 'Viewer',
      lastName: 'User',
      role: 'VIEWER',
    },
  ];

  const createdUsers = [];

  for (const userData of testUsers) {
    try {
      console.log(`Creating user: ${userData.email}...`);

      // 1. Check if user already exists in Supabase
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === userData.email);

      let supabaseUserId: string;

      if (existingUser) {
        console.log(`  ⚠️  User ${userData.email} already exists in Supabase (ID: ${existingUser.id})`);
        supabaseUserId = existingUser.id;
      } else {
        // 2. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true, // Auto-confirm email for test users
          user_metadata: {
            full_name: userData.fullName,
            first_name: userData.firstName,
            last_name: userData.lastName,
          },
        });

        if (authError || !authData.user) {
          console.error(`  ❌ Failed to create user in Supabase: ${authError?.message}`);
          continue;
        }

        supabaseUserId = authData.user.id;
        console.log(`  ✅ Created in Supabase Auth (ID: ${supabaseUserId})`);
      }

      // 3. Check if user exists in Prisma (by supabaseUserId or email)
      let prismaUser = await prisma.user.findUnique({
        where: { supabaseUserId },
      });

      if (!prismaUser) {
        // Check by email
        prismaUser = await prisma.user.findUnique({
          where: { email: userData.email },
        });
      }

      if (prismaUser) {
        // Update existing user with Supabase ID if missing
        if (!prismaUser.supabaseUserId) {
          await prisma.user.update({
            where: { id: prismaUser.id },
            data: { supabaseUserId, role: userData.role },
          });
          console.log(`  ✅ Updated Prisma user with Supabase ID (ID: ${prismaUser.id})`);
        } else {
          console.log(`  ⚠️  User already exists in Prisma (ID: ${prismaUser.id})`);
        }

        createdUsers.push({
          email: userData.email,
          password: userData.password,
          role: prismaUser.role,
          existed: true,
        });
        continue;
      }

      // 4. Create user profile in Prisma
      prismaUser = await prisma.user.create({
        data: {
          email: userData.email,
          password: '', // Password is managed by Supabase, not Prisma
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          emailVerified: true,
          isActive: true,
          supabaseUserId,
        },
      });

      console.log(`  ✅ Created in Prisma (ID: ${prismaUser.id})`);
      console.log(`  ✅ ${userData.role} user created successfully\n`);

      createdUsers.push({
        email: userData.email,
        password: userData.password,
        role: userData.role,
        existed: false,
      });
    } catch (error: any) {
      console.error(`❌ Failed to create user ${userData.email}:`, error.message);
    }
  }

  console.log('\n📋 Test User Credentials:\n');
  console.log('┌─────────────────────┬──────────────┬──────────┬────────────┐');
  console.log('│ Email               │ Password     │ Role     │ Status     │');
  console.log('├─────────────────────┼──────────────┼──────────┼────────────┤');
  createdUsers.forEach((user) => {
    const status = user.existed ? 'Existing' : 'Created';
    console.log(
      `│ ${user.email.padEnd(19)} │ ${user.password.padEnd(12)} │ ${user.role.padEnd(8)} │ ${status.padEnd(10)} │`
    );
  });
  console.log('└─────────────────────┴──────────────┴──────────┴────────────┘');

  console.log('\n💡 Use these credentials to sign in to the application.');
  console.log('🌐 Frontend: http://localhost:8080');
  console.log('🔌 Backend API: http://localhost:3002');
  console.log('🔑 Auth Endpoint: POST http://localhost:3002/api/auth/v2/login\n');

  await prisma.$disconnect();
}

createTestUsers()
  .catch((error) => {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  });
