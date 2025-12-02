/**
 * Test Supabase Connection
 *
 * Verifies Supabase configuration and connectivity
 * Run: npx ts-node scripts/test-supabase-connection.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabase, supabaseAdmin } from '../src/utils/supabase';

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Check environment variables
  console.log('1. Environment Variables:');
  console.log(process.env.SUPABASE_URL ? '   ✅ SUPABASE_URL configured' : '   ❌ SUPABASE_URL missing');
  console.log(process.env.SUPABASE_ANON_KEY ? '   ✅ SUPABASE_ANON_KEY configured' : '   ❌ SUPABASE_ANON_KEY missing');
  console.log(process.env.SUPABASE_SERVICE_ROLE_KEY ? '   ✅ SUPABASE_SERVICE_ROLE_KEY configured' : '   ❌ SUPABASE_SERVICE_ROLE_KEY missing');
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing required Supabase configuration');
    console.log('\nAdd these to your .env file:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_ANON_KEY=your-anon-key');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    process.exit(1);
  }

  // Test public client connection
  console.log('2. Testing Public Client:');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message !== 'Auth session missing!') {
      console.log(`   ⚠️  ${error.message}`);
    } else {
      console.log('   ✅ Successfully connected to Supabase');
    }
  } catch (err: any) {
    console.error('   ❌ Failed to connect:', err.message);
    process.exit(1);
  }
  console.log('');

  // Test admin client
  console.log('3. Testing Admin Client:');
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) {
      console.log(`   ⚠️  Admin API error: ${error.message}`);
      console.log('   (This is expected if SERVICE_ROLE_KEY is not set)');
    } else {
      console.log('   ✅ Admin API is working');
      console.log(`   📊 Current user count: ${data.users.length > 0 ? 'At least 1 user' : '0 users'}`);
    }
  } catch (err: any) {
    console.error('   ❌ Admin API failed:', err.message);
  }
  console.log('');

  console.log('✅ Supabase connection test complete!\n');
  console.log('Next steps:');
  console.log('  1. Continue with Phase 2: Middleware Migration');
  console.log('  2. See docs/SUPABASE_AUTH_MIGRATION_PLAN.md');
}

testSupabaseConnection().catch(console.error);
