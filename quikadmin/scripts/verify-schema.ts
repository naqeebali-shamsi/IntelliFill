import { prisma } from '../src/utils/prisma';

async function verifySchema() {
  console.log('🔍 Verifying Prisma schema...\n');

  try {
    // Test each model
    const tests = [
      { name: 'Users', fn: () => prisma.user.count() },
      { name: 'RefreshTokens', fn: () => prisma.refreshToken.count() },
      { name: 'Sessions', fn: () => prisma.session.count() },
      { name: 'Documents', fn: () => prisma.document.count() },
      { name: 'Templates', fn: () => prisma.template.count() },
      { name: 'FieldMappings', fn: () => prisma.fieldMapping.count() },
      { name: 'Jobs', fn: () => prisma.job.count() },
      { name: 'ProcessingHistory', fn: () => prisma.processingHistory.count() },
      { name: 'UserSettings', fn: () => prisma.userSettings.count() },
      { name: 'ApiUsage', fn: () => prisma.apiUsage.count() },
      { name: 'MlModels', fn: () => prisma.mlModel.count() },
      { name: 'AuditLogs', fn: () => prisma.auditLog.count() },
    ];

    for (const test of tests) {
      try {
        const count = await test.fn();
        console.log(`✅ ${test.name.padEnd(20)} - ${count} records`);
      } catch (error) {
        console.log(`❌ ${test.name.padEnd(20)} - ERROR: ${error.message}`);
      }
    }

    console.log('\n✅ Schema verification complete!');
    console.log(`\n📊 Total models tested: ${tests.length}`);

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifySchema();
