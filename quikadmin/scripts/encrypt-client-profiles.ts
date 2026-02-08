/**
 * Migration script: Encrypt existing ClientProfile data
 *
 * Encrypts all plaintext ClientProfile.data records using encryptJSON().
 * Safe to run multiple times - skips already-encrypted records.
 *
 * Usage: npx tsx scripts/encrypt-client-profiles.ts
 */

import { prisma } from '../src/utils/prisma';
import { encryptJSON, decryptJSON } from '../src/utils/encryption';

async function migrateClientProfiles() {
  const profiles = await prisma.clientProfile.findMany();
  let migrated = 0;
  let skipped = 0;

  for (const profile of profiles) {
    if (!profile.data) {
      skipped++;
      continue;
    }

    // Check if already encrypted (string with colon-separated base64)
    if (typeof profile.data === 'string' && (profile.data as string).split(':').length === 3) {
      skipped++;
      continue;
    }

    const plainData = typeof profile.data === 'string' ? JSON.parse(profile.data) : profile.data;

    await prisma.clientProfile.update({
      where: { id: profile.id },
      data: { data: encryptJSON(plainData) },
    });
    migrated++;
  }

  console.log(`Migrated: ${migrated}, Skipped: ${skipped}`);
}

migrateClientProfiles()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
