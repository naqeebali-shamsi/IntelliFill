/**
 * Test script for Neon Serverless Driver
 *
 * This script validates the Neon Serverless driver installation and basic functionality.
 *
 * Usage:
 *   npx ts-node scripts/test-neon-serverless.ts
 */

import * as dotenv from 'dotenv';
import { NeonServerlessService } from '../src/services/NeonServerlessService';

// Load environment variables
dotenv.config();

async function testNeonServerless() {
  console.log('\n=== Neon Serverless Driver Test ===\n');

  try {
    // Initialize the serverless driver
    console.log('1. Initializing Neon Serverless driver...');
    const db = new NeonServerlessService();
    console.log('   ✅ Driver initialized\n');

    // Test connection
    console.log('2. Testing database connection...');
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('   ✅ Connection test successful\n');
    } else {
      console.log('   ❌ Connection test failed\n');
      return;
    }

    // Test basic query
    console.log('3. Testing basic query (SELECT NOW())...');
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('   ✅ Query successful');
    console.log(`   Current Time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL Version: ${result.rows[0].pg_version}\n`);

    // Test parameterized query
    console.log('4. Testing parameterized query...');
    const paramResult = await db.query('SELECT $1 as message, $2 as number', ['Hello from Serverless!', 42]);
    console.log('   ✅ Parameterized query successful');
    console.log(`   Message: ${paramResult.rows[0].message}`);
    console.log(`   Number: ${paramResult.rows[0].number}\n`);

    // Close (no-op for serverless)
    console.log('5. Closing connection...');
    await db.close();
    console.log('   ✅ Close called (no-op for serverless)\n');

    console.log('=== All Tests Passed ===\n');
    console.log('✅ Neon Serverless driver is working correctly!');
    console.log('\nKey Features:');
    console.log('  - HTTP-based connection (no TCP)');
    console.log('  - No connection pooling needed');
    console.log('  - Optimized for edge/serverless environments');
    console.log('  - Fast cold starts\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure DATABASE_URL is set in .env');
    console.error('  2. Verify Neon database is accessible');
    console.error('  3. Check network connectivity');
    console.error('  4. Ensure @neondatabase/serverless is installed\n');
    process.exit(1);
  }
}

// Run the test
testNeonServerless().catch(console.error);
