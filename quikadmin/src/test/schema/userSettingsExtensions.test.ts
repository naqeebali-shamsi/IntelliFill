/**
 * UserSettings Schema Extension Tests (Task 381)
 *
 * TDD tests for extending UserSettings model with notification and UI preferences.
 * Tests verify that new fields have correct defaults and are properly optional.
 *
 * New fields being tested:
 * - notifyOnProcessComplete (Boolean, default: true)
 * - notifyOnOrgInvite (Boolean, default: true)
 * - digestFrequency (String, default: "never")
 * - theme (String, default: "system")
 * - compactMode (Boolean, default: false)
 *
 * @module test/schema/userSettingsExtensions
 */

import { PrismaClient } from '@prisma/client';

// Use the singleton prisma instance from utils/prisma
import { prisma } from '../../utils/prisma';

describe('UserSettings Schema Extensions (Task 381)', () => {
  let testUserId: string;
  let createdSettingsIds: string[] = [];

  // Setup: Create a test user before running tests
  beforeAll(async () => {
    // Create a test user for UserSettings relation
    const testUser = await prisma.user.create({
      data: {
        email: `test-settings-${Date.now()}@example.com`,
        password: 'hashedPasswordPlaceholder',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    testUserId = testUser.id;
  });

  // Cleanup: Delete all test data after tests complete
  afterAll(async () => {
    // Delete test user settings
    if (testUserId) {
      await prisma.userSettings.deleteMany({
        where: { userId: testUserId },
      });

      // Delete test user
      await prisma.user.delete({
        where: { id: testUserId },
      });
    }

    // Disconnect Prisma client
    await prisma.$disconnect();
  });

  // Reset any settings created during tests
  afterEach(async () => {
    if (createdSettingsIds.length > 0) {
      await prisma.userSettings.deleteMany({
        where: { userId: { in: createdSettingsIds } },
      });
      createdSettingsIds = [];
    }
  });

  // ==========================================================================
  // Test 1: notifyOnProcessComplete defaults to true
  // ==========================================================================

  describe('notifyOnProcessComplete field', () => {
    it('should default to true when not explicitly set', async () => {
      const settings = await prisma.userSettings.create({
        data: {
          userId: testUserId,
        },
      });

      expect(settings.notifyOnProcessComplete).toBe(true);
    });

    it('should allow explicit setting to false', async () => {
      // Create second test user for this test
      const user2 = await prisma.user.create({
        data: {
          email: `test-settings-explicit-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user2.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user2.id,
          notifyOnProcessComplete: false,
        },
      });

      expect(settings.notifyOnProcessComplete).toBe(false);
    });

    it('should allow explicit setting to true', async () => {
      // Create third test user for this test
      const user3 = await prisma.user.create({
        data: {
          email: `test-settings-explicit-true-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user3.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user3.id,
          notifyOnProcessComplete: true,
        },
      });

      expect(settings.notifyOnProcessComplete).toBe(true);
    });
  });

  // ==========================================================================
  // Test 2: notifyOnOrgInvite defaults to true
  // ==========================================================================

  describe('notifyOnOrgInvite field', () => {
    it('should default to true when not explicitly set', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-org-notify-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      expect(settings.notifyOnOrgInvite).toBe(true);
    });

    it('should allow explicit setting to false', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-org-notify-false-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          notifyOnOrgInvite: false,
        },
      });

      expect(settings.notifyOnOrgInvite).toBe(false);
    });
  });

  // ==========================================================================
  // Test 3: digestFrequency defaults to "never"
  // ==========================================================================

  describe('digestFrequency field', () => {
    it('should default to "never" when not explicitly set', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-digest-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      expect(settings.digestFrequency).toBe('never');
    });

    it('should allow setting to "daily"', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-digest-daily-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          digestFrequency: 'daily',
        },
      });

      expect(settings.digestFrequency).toBe('daily');
    });

    it('should allow setting to "weekly"', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-digest-weekly-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          digestFrequency: 'weekly',
        },
      });

      expect(settings.digestFrequency).toBe('weekly');
    });

    it('should accept "never" value explicitly', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-digest-never-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          digestFrequency: 'never',
        },
      });

      expect(settings.digestFrequency).toBe('never');
    });
  });

  // ==========================================================================
  // Test 4: theme defaults to "system"
  // ==========================================================================

  describe('theme field', () => {
    it('should default to "system" when not explicitly set', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-theme-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      expect(settings.theme).toBe('system');
    });

    it('should allow setting to "light"', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-theme-light-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          theme: 'light',
        },
      });

      expect(settings.theme).toBe('light');
    });

    it('should allow setting to "dark"', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-theme-dark-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          theme: 'dark',
        },
      });

      expect(settings.theme).toBe('dark');
    });

    it('should accept "system" value explicitly', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-theme-system-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          theme: 'system',
        },
      });

      expect(settings.theme).toBe('system');
    });
  });

  // ==========================================================================
  // Test 5: compactMode defaults to false
  // ==========================================================================

  describe('compactMode field', () => {
    it('should default to false when not explicitly set', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-compact-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      expect(settings.compactMode).toBe(false);
    });

    it('should allow explicit setting to true', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-compact-true-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          compactMode: true,
        },
      });

      expect(settings.compactMode).toBe(true);
    });

    it('should allow explicit setting to false', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-compact-false-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          compactMode: false,
        },
      });

      expect(settings.compactMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test 6: All new fields are optional (nullable or have defaults)
  // ==========================================================================

  describe('Optional fields validation', () => {
    it('should create UserSettings without specifying any new fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-optional-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      // Should not throw error when creating settings without new fields
      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      // Verify all new fields have their expected defaults
      expect(settings.notifyOnProcessComplete).toBe(true);
      expect(settings.notifyOnOrgInvite).toBe(true);
      expect(settings.digestFrequency).toBe('never');
      expect(settings.theme).toBe('system');
      expect(settings.compactMode).toBe(false);
    });

    it('should create UserSettings with only some new fields specified', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-partial-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          theme: 'dark', // Only set theme
        },
      });

      // Verify specified field
      expect(settings.theme).toBe('dark');

      // Verify other fields have defaults
      expect(settings.notifyOnProcessComplete).toBe(true);
      expect(settings.notifyOnOrgInvite).toBe(true);
      expect(settings.digestFrequency).toBe('never');
      expect(settings.compactMode).toBe(false);
    });

    it('should update individual new fields independently', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-update-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
        },
      });

      // Update only digestFrequency
      const updated = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          digestFrequency: 'daily',
        },
      });

      expect(updated.digestFrequency).toBe('daily');
      // Other fields should remain unchanged
      expect(updated.notifyOnProcessComplete).toBe(true);
      expect(updated.notifyOnOrgInvite).toBe(true);
      expect(updated.theme).toBe('system');
      expect(updated.compactMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test 7: Integration tests - Combined field operations
  // ==========================================================================

  describe('Integration tests', () => {
    it('should handle all new fields together', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-integration-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          notifyOnProcessComplete: false,
          notifyOnOrgInvite: false,
          digestFrequency: 'weekly',
          theme: 'light',
          compactMode: true,
        },
      });

      expect(settings.notifyOnProcessComplete).toBe(false);
      expect(settings.notifyOnOrgInvite).toBe(false);
      expect(settings.digestFrequency).toBe('weekly');
      expect(settings.theme).toBe('light');
      expect(settings.compactMode).toBe(true);
    });

    it('should preserve existing UserSettings fields when updating new fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-preserve-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      // Create settings with existing fields
      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          preferredLanguage: 'es',
          emailNotifications: false,
          autoOcr: true,
        },
      });

      // Update only new fields
      const updated = await prisma.userSettings.update({
        where: { userId: user.id },
        data: {
          theme: 'dark',
          compactMode: true,
        },
      });

      // Verify existing fields are preserved
      expect(updated.preferredLanguage).toBe('es');
      expect(updated.emailNotifications).toBe(false);
      expect(updated.autoOcr).toBe(true);

      // Verify new fields are updated
      expect(updated.theme).toBe('dark');
      expect(updated.compactMode).toBe(true);
    });

    it('should retrieve UserSettings with all fields via user relation', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-relation-${Date.now()}@example.com`,
          password: 'hashedPassword',
          settings: {
            create: {
              notifyOnProcessComplete: false,
              digestFrequency: 'daily',
              theme: 'dark',
            },
          },
        },
        include: {
          settings: true,
        },
      });
      createdSettingsIds.push(user.id);

      expect(user.settings).not.toBeNull();
      expect(user.settings?.notifyOnProcessComplete).toBe(false);
      expect(user.settings?.digestFrequency).toBe('daily');
      expect(user.settings?.theme).toBe('dark');
      // Defaults should be present
      expect(user.settings?.notifyOnOrgInvite).toBe(true);
      expect(user.settings?.compactMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test 8: Edge cases and validation
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle empty string values for string fields', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-edge-empty-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      // Empty strings should be accepted (not enforced as enum at DB level)
      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          digestFrequency: '',
          theme: '',
        },
      });

      expect(settings.digestFrequency).toBe('');
      expect(settings.theme).toBe('');
    });

    it('should respect VARCHAR length limits', async () => {
      const user = await prisma.user.create({
        data: {
          email: `test-edge-length-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      // digestFrequency has VARCHAR(20) limit
      const longDigestFrequency = 'a'.repeat(20); // Max allowed

      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          digestFrequency: longDigestFrequency,
        },
      });

      expect(settings.digestFrequency).toBe(longDigestFrequency);
      expect(settings.digestFrequency.length).toBe(20);
    });

    it('should maintain field defaults after migration for existing records', async () => {
      // This test simulates existing UserSettings records
      // The migration should add default values to existing records

      const user = await prisma.user.create({
        data: {
          email: `test-migration-${Date.now()}@example.com`,
          password: 'hashedPassword',
        },
      });
      createdSettingsIds.push(user.id);

      // Create settings (simulating pre-migration record)
      const settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          preferredLanguage: 'en',
        },
      });

      // Fetch the record to verify defaults are applied
      const fetched = await prisma.userSettings.findUnique({
        where: { userId: user.id },
      });

      expect(fetched).not.toBeNull();
      expect(fetched?.notifyOnProcessComplete).toBe(true);
      expect(fetched?.notifyOnOrgInvite).toBe(true);
      expect(fetched?.digestFrequency).toBe('never');
      expect(fetched?.theme).toBe('system');
      expect(fetched?.compactMode).toBe(false);
    });
  });
});
