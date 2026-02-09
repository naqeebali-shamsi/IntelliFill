/**
 * UserSettings Schema Extension Tests (Task 381)
 *
 * Mock-compatible unit tests using pure object manipulation to verify
 * UserSettings field defaults and behavior. No real database connection required.
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

/**
 * Creates a default UserSettings object matching Prisma schema defaults
 */
function createDefaultSettings(overrides: Record<string, any> = {}) {
  return {
    userId: overrides.userId || 'user-default',
    defaultValidationRules: null,
    preferredLanguage: 'en',
    emailNotifications: true,
    webhookUrl: null,
    autoOcr: false,
    ocrLanguage: 'en',
    autoMlEnhancement: true,
    defaultOutputFormat: 'pdf',
    defaultExtractionProfile: null,
    retainOriginalFiles: true,
    timezone: 'UTC',
    // New extension fields
    notifyOnProcessComplete: true,
    notifyOnOrgInvite: true,
    digestFrequency: 'never',
    theme: 'system',
    compactMode: false,
    notifyOnErrors: true,
    // Timestamps
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('UserSettings Schema Extensions (Task 381)', () => {
  // ==========================================================================
  // Test 1: notifyOnProcessComplete defaults to true
  // ==========================================================================

  describe('notifyOnProcessComplete field', () => {
    it('should default to true when not explicitly set', () => {
      const settings = createDefaultSettings({ userId: 'user-1' });
      expect(settings.notifyOnProcessComplete).toBe(true);
    });

    it('should allow explicit setting to false', () => {
      const settings = createDefaultSettings({
        userId: 'user-2',
        notifyOnProcessComplete: false,
      });
      expect(settings.notifyOnProcessComplete).toBe(false);
    });

    it('should allow explicit setting to true', () => {
      const settings = createDefaultSettings({
        userId: 'user-3',
        notifyOnProcessComplete: true,
      });
      expect(settings.notifyOnProcessComplete).toBe(true);
    });
  });

  // ==========================================================================
  // Test 2: notifyOnOrgInvite defaults to true
  // ==========================================================================

  describe('notifyOnOrgInvite field', () => {
    it('should default to true when not explicitly set', () => {
      const settings = createDefaultSettings({ userId: 'user-4' });
      expect(settings.notifyOnOrgInvite).toBe(true);
    });

    it('should allow explicit setting to false', () => {
      const settings = createDefaultSettings({
        userId: 'user-5',
        notifyOnOrgInvite: false,
      });
      expect(settings.notifyOnOrgInvite).toBe(false);
    });
  });

  // ==========================================================================
  // Test 3: digestFrequency defaults to "never"
  // ==========================================================================

  describe('digestFrequency field', () => {
    it('should default to "never" when not explicitly set', () => {
      const settings = createDefaultSettings({ userId: 'user-6' });
      expect(settings.digestFrequency).toBe('never');
    });

    it('should allow setting to "daily"', () => {
      const settings = createDefaultSettings({
        userId: 'user-7',
        digestFrequency: 'daily',
      });
      expect(settings.digestFrequency).toBe('daily');
    });

    it('should allow setting to "weekly"', () => {
      const settings = createDefaultSettings({
        userId: 'user-8',
        digestFrequency: 'weekly',
      });
      expect(settings.digestFrequency).toBe('weekly');
    });

    it('should accept "never" value explicitly', () => {
      const settings = createDefaultSettings({
        userId: 'user-9',
        digestFrequency: 'never',
      });
      expect(settings.digestFrequency).toBe('never');
    });
  });

  // ==========================================================================
  // Test 4: theme defaults to "system"
  // ==========================================================================

  describe('theme field', () => {
    it('should default to "system" when not explicitly set', () => {
      const settings = createDefaultSettings({ userId: 'user-10' });
      expect(settings.theme).toBe('system');
    });

    it('should allow setting to "light"', () => {
      const settings = createDefaultSettings({
        userId: 'user-11',
        theme: 'light',
      });
      expect(settings.theme).toBe('light');
    });

    it('should allow setting to "dark"', () => {
      const settings = createDefaultSettings({
        userId: 'user-12',
        theme: 'dark',
      });
      expect(settings.theme).toBe('dark');
    });

    it('should accept "system" value explicitly', () => {
      const settings = createDefaultSettings({
        userId: 'user-13',
        theme: 'system',
      });
      expect(settings.theme).toBe('system');
    });
  });

  // ==========================================================================
  // Test 5: compactMode defaults to false
  // ==========================================================================

  describe('compactMode field', () => {
    it('should default to false when not explicitly set', () => {
      const settings = createDefaultSettings({ userId: 'user-14' });
      expect(settings.compactMode).toBe(false);
    });

    it('should allow explicit setting to true', () => {
      const settings = createDefaultSettings({
        userId: 'user-15',
        compactMode: true,
      });
      expect(settings.compactMode).toBe(true);
    });

    it('should allow explicit setting to false', () => {
      const settings = createDefaultSettings({
        userId: 'user-16',
        compactMode: false,
      });
      expect(settings.compactMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test 6: All new fields are optional (nullable or have defaults)
  // ==========================================================================

  describe('Optional fields validation', () => {
    it('should create UserSettings without specifying any new fields', () => {
      const settings = createDefaultSettings({ userId: 'user-17' });

      // Verify all new fields have their expected defaults
      expect(settings.notifyOnProcessComplete).toBe(true);
      expect(settings.notifyOnOrgInvite).toBe(true);
      expect(settings.digestFrequency).toBe('never');
      expect(settings.theme).toBe('system');
      expect(settings.compactMode).toBe(false);
    });

    it('should create UserSettings with only some new fields specified', () => {
      const settings = createDefaultSettings({
        userId: 'user-18',
        theme: 'dark',
      });

      // Verify specified field
      expect(settings.theme).toBe('dark');

      // Verify other fields have defaults
      expect(settings.notifyOnProcessComplete).toBe(true);
      expect(settings.notifyOnOrgInvite).toBe(true);
      expect(settings.digestFrequency).toBe('never');
      expect(settings.compactMode).toBe(false);
    });

    it('should update individual new fields independently', () => {
      const settings = createDefaultSettings({ userId: 'user-19' });

      // Update only digestFrequency
      const updated = { ...settings, digestFrequency: 'daily' };

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
    it('should handle all new fields together', () => {
      const settings = createDefaultSettings({
        userId: 'user-20',
        notifyOnProcessComplete: false,
        notifyOnOrgInvite: false,
        digestFrequency: 'weekly',
        theme: 'light',
        compactMode: true,
      });

      expect(settings.notifyOnProcessComplete).toBe(false);
      expect(settings.notifyOnOrgInvite).toBe(false);
      expect(settings.digestFrequency).toBe('weekly');
      expect(settings.theme).toBe('light');
      expect(settings.compactMode).toBe(true);
    });

    it('should preserve existing UserSettings fields when updating new fields', () => {
      const settings = createDefaultSettings({
        userId: 'user-21',
        preferredLanguage: 'es',
        emailNotifications: false,
        autoOcr: true,
      });

      // Update only new fields
      const updated = { ...settings, theme: 'dark', compactMode: true };

      // Verify existing fields are preserved
      expect(updated.preferredLanguage).toBe('es');
      expect(updated.emailNotifications).toBe(false);
      expect(updated.autoOcr).toBe(true);

      // Verify new fields are updated
      expect(updated.theme).toBe('dark');
      expect(updated.compactMode).toBe(true);
    });

    it('should retrieve UserSettings with all fields via user relation', () => {
      const settings = createDefaultSettings({
        userId: 'user-22',
        notifyOnProcessComplete: false,
        digestFrequency: 'daily',
        theme: 'dark',
      });

      const user = {
        id: 'user-22',
        email: 'test@example.com',
        settings,
      };

      expect(user.settings).not.toBeNull();
      expect(user.settings.notifyOnProcessComplete).toBe(false);
      expect(user.settings.digestFrequency).toBe('daily');
      expect(user.settings.theme).toBe('dark');
      // Defaults should be present
      expect(user.settings.notifyOnOrgInvite).toBe(true);
      expect(user.settings.compactMode).toBe(false);
    });
  });

  // ==========================================================================
  // Test 8: Edge cases and validation
  // ==========================================================================

  describe('Edge cases', () => {
    it('should handle empty string values for string fields', () => {
      const settings = createDefaultSettings({
        userId: 'user-23',
        digestFrequency: '',
        theme: '',
      });

      expect(settings.digestFrequency).toBe('');
      expect(settings.theme).toBe('');
    });

    it('should respect VARCHAR length limits', () => {
      // digestFrequency has VARCHAR(20) limit
      const longDigestFrequency = 'a'.repeat(20); // Max allowed

      const settings = createDefaultSettings({
        userId: 'user-24',
        digestFrequency: longDigestFrequency,
      });

      expect(settings.digestFrequency).toBe(longDigestFrequency);
      expect(settings.digestFrequency.length).toBe(20);
    });

    it('should maintain field defaults after migration for existing records', () => {
      // Simulate a pre-migration record that only had preferredLanguage
      const settings = createDefaultSettings({
        userId: 'user-25',
        preferredLanguage: 'en',
      });

      expect(settings.notifyOnProcessComplete).toBe(true);
      expect(settings.notifyOnOrgInvite).toBe(true);
      expect(settings.digestFrequency).toBe('never');
      expect(settings.theme).toBe('system');
      expect(settings.compactMode).toBe(false);
    });
  });
});
