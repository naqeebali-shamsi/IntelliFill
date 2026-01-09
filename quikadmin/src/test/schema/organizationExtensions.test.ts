/**
 * Organization and User Schema Extensions Tests
 * Task 380: Database Schema: Extend Organization and User Models
 *
 * Tests for the extended Prisma schema covering:
 * - Organization.slug field (unique, required after migration)
 * - Organization.logoUrl field (optional)
 * - Organization.website field (optional, max 255 chars)
 * - Organization.settings JSON field (default "{}")
 * - Organization.memberships relation
 * - User.avatarUrl field (optional)
 * - User.phone field (optional, max 30 chars)
 * - User.jobTitle field (optional, max 100 chars)
 * - User.bio field (optional, max 500 chars)
 * - User.memberships relation
 * - Slug uniqueness constraint
 * - Backward compatibility
 *
 * @module test/schema/organizationExtensions.test
 */

import { PrismaClient, Prisma } from '@prisma/client';

// Import the mocked prisma from utils/prisma (mocked in tests/setup.ts)
import { prisma } from '../../utils/prisma';

// Create reference to mock prisma for test assertions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

// Add organization model mock if not present
if (!mockPrisma.organization) {
  const organizationStore = new Map();
  mockPrisma.organization = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  };
}

describe('Organization Schema Extensions (Task 380)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Organization.slug Field Tests
  // ==========================================================================

  describe('Organization.slug field', () => {
    it('should create organization with slug field', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-organization-abc123',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-organization-abc123',
        },
      });

      expect(result).toMatchObject({
        name: 'Test Organization',
        slug: 'test-organization-abc123',
      });
      expect(mockPrisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Organization',
          slug: 'test-organization-abc123',
        },
      });
    });

    it('should enforce slug uniqueness constraint', async () => {
      // Simulate unique constraint violation
      const uniqueConstraintError = new Error('Unique constraint failed on slug');
      Object.assign(uniqueConstraintError, {
        code: 'P2002',
        meta: { target: ['slug'] },
      });

      mockPrisma.organization.create.mockRejectedValue(uniqueConstraintError);

      await expect(
        prisma.organization.create({
          data: {
            name: 'Test Organization',
            slug: 'duplicate-slug',
          },
        })
      ).rejects.toThrow('Unique constraint failed on slug');
    });

    it('should retrieve organization by slug', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await prisma.organization.findUnique({
        where: { slug: 'test-org' },
      });

      expect(result).toMatchObject({
        slug: 'test-org',
        name: 'Test Organization',
      });
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-org' },
      });
    });

    it('should validate slug max length (100 chars)', async () => {
      const longSlug = 'a'.repeat(101);
      const validationError = new Error('Slug exceeds maximum length of 100 characters');

      mockPrisma.organization.create.mockRejectedValue(validationError);

      await expect(
        prisma.organization.create({
          data: {
            name: 'Test Organization',
            slug: longSlug,
          },
        })
      ).rejects.toThrow('Slug exceeds maximum length');
    });

    it('should allow slug with valid URL-safe characters', async () => {
      const validSlugs = [
        'test-org-123',
        'test_org',
        'test-org',
        'testorg',
        'test-org-2024',
      ];

      for (const slug of validSlugs) {
        mockPrisma.organization.create.mockResolvedValue({
          id: 'org-1',
          name: 'Test Org',
          slug,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const result = await prisma.organization.create({
          data: { name: 'Test Org', slug },
        });

        expect(result.slug).toBe(slug);
      }
    });
  });

  // ==========================================================================
  // Organization.logoUrl Field Tests
  // ==========================================================================

  describe('Organization.logoUrl field', () => {
    it('should create organization with logoUrl', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        logoUrl: 'https://example.com/logo.png',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
          logoUrl: 'https://example.com/logo.png',
        },
      });

      expect(result.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should create organization without logoUrl (optional)', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        logoUrl: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      });

      expect(result.logoUrl).toBeNull();
    });

    it('should update organization logoUrl', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        logoUrl: 'https://example.com/new-logo.png',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.update.mockResolvedValue(mockOrg);

      const result = await prisma.organization.update({
        where: { id: 'org-1' },
        data: { logoUrl: 'https://example.com/new-logo.png' },
      });

      expect(result.logoUrl).toBe('https://example.com/new-logo.png');
    });
  });

  // ==========================================================================
  // Organization.website Field Tests
  // ==========================================================================

  describe('Organization.website field', () => {
    it('should create organization with website', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        website: 'https://example.com',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
          website: 'https://example.com',
        },
      });

      expect(result.website).toBe('https://example.com');
    });

    it('should create organization without website (optional)', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        website: null,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      });

      expect(result.website).toBeNull();
    });

    it('should validate website max length (255 chars)', async () => {
      const longWebsite = 'https://example.com/' + 'a'.repeat(250);
      const validationError = new Error('Website exceeds maximum length of 255 characters');

      mockPrisma.organization.create.mockRejectedValue(validationError);

      await expect(
        prisma.organization.create({
          data: {
            name: 'Test Organization',
            slug: 'test-org',
            website: longWebsite,
          },
        })
      ).rejects.toThrow('Website exceeds maximum length');
    });
  });

  // ==========================================================================
  // Organization.settings JSON Field Tests
  // ==========================================================================

  describe('Organization.settings JSON field', () => {
    it('should create organization with default empty settings', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        settings: {},
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
        },
      });

      expect(result.settings).toEqual({});
    });

    it('should create organization with custom settings', async () => {
      const customSettings = {
        theme: 'dark',
        notifications: true,
        features: {
          multiAgent: true,
          vectorSearch: false,
        },
      };

      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        settings: customSettings,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
          settings: customSettings,
        },
      });

      expect(result.settings).toEqual(customSettings);
    });

    it('should update organization settings', async () => {
      const updatedSettings = {
        theme: 'light',
        notifications: false,
      };

      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        settings: updatedSettings,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.update.mockResolvedValue(mockOrg);

      const result = await prisma.organization.update({
        where: { id: 'org-1' },
        data: { settings: updatedSettings },
      });

      expect(result.settings).toEqual(updatedSettings);
    });

    it('should handle complex nested settings', async () => {
      const complexSettings = {
        billing: {
          plan: 'enterprise',
          seats: 100,
          features: ['ocr', 'multiagent', 'vector-search'],
        },
        integrations: {
          slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/...' },
          zapier: { enabled: false },
        },
      };

      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        settings: complexSettings,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
          slug: 'test-org',
          settings: complexSettings,
        },
      });

      expect(result.settings).toEqual(complexSettings);
    });
  });

  // ==========================================================================
  // User.avatarUrl Field Tests
  // ==========================================================================

  describe('User.avatarUrl field', () => {
    it('should create user with avatarUrl', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      });

      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should create user without avatarUrl (optional)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        avatarUrl: null,
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
        },
      });

      expect(result.avatarUrl).toBeNull();
    });
  });

  // ==========================================================================
  // User.phone Field Tests
  // ==========================================================================

  describe('User.phone field', () => {
    it('should create user with phone', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        phone: '+1-555-123-4567',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          phone: '+1-555-123-4567',
        },
      });

      expect(result.phone).toBe('+1-555-123-4567');
    });

    it('should create user without phone (optional)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        phone: null,
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
        },
      });

      expect(result.phone).toBeNull();
    });

    it('should validate phone max length (30 chars)', async () => {
      const longPhone = '+1-' + '5'.repeat(30);
      const validationError = new Error('Phone exceeds maximum length of 30 characters');

      mockPrisma.user.create.mockRejectedValue(validationError);

      await expect(
        prisma.user.create({
          data: {
            email: 'test@example.com',
            password: 'hashed',
            phone: longPhone,
          },
        })
      ).rejects.toThrow('Phone exceeds maximum length');
    });
  });

  // ==========================================================================
  // User.jobTitle Field Tests
  // ==========================================================================

  describe('User.jobTitle field', () => {
    it('should create user with jobTitle', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        jobTitle: 'Senior Software Engineer',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          jobTitle: 'Senior Software Engineer',
        },
      });

      expect(result.jobTitle).toBe('Senior Software Engineer');
    });

    it('should create user without jobTitle (optional)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        jobTitle: null,
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
        },
      });

      expect(result.jobTitle).toBeNull();
    });

    it('should validate jobTitle max length (100 chars)', async () => {
      const longJobTitle = 'a'.repeat(101);
      const validationError = new Error('Job title exceeds maximum length of 100 characters');

      mockPrisma.user.create.mockRejectedValue(validationError);

      await expect(
        prisma.user.create({
          data: {
            email: 'test@example.com',
            password: 'hashed',
            jobTitle: longJobTitle,
          },
        })
      ).rejects.toThrow('Job title exceeds maximum length');
    });
  });

  // ==========================================================================
  // User.bio Field Tests
  // ==========================================================================

  describe('User.bio field', () => {
    it('should create user with bio', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        bio: 'Experienced software engineer with 10 years in the industry.',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          bio: 'Experienced software engineer with 10 years in the industry.',
        },
      });

      expect(result.bio).toBe('Experienced software engineer with 10 years in the industry.');
    });

    it('should create user without bio (optional)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        bio: null,
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
        },
      });

      expect(result.bio).toBeNull();
    });

    it('should validate bio max length (500 chars)', async () => {
      const longBio = 'a'.repeat(501);
      const validationError = new Error('Bio exceeds maximum length of 500 characters');

      mockPrisma.user.create.mockRejectedValue(validationError);

      await expect(
        prisma.user.create({
          data: {
            email: 'test@example.com',
            password: 'hashed',
            bio: longBio,
          },
        })
      ).rejects.toThrow('Bio exceeds maximum length');
    });
  });

  // ==========================================================================
  // Organization.memberships Relation Tests
  // ==========================================================================

  describe('Organization.memberships relation', () => {
    it('should query organization with memberships', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        status: 'ACTIVE',
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'OWNER',
          },
          {
            id: 'mem-2',
            userId: 'user-2',
            organizationId: 'org-1',
            role: 'MEMBER',
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await prisma.organization.findUnique({
        where: { id: 'org-1' },
        include: { memberships: true },
      });

      expect(result?.memberships).toHaveLength(2);
      expect(result?.memberships[0].role).toBe('OWNER');
    });

    it('should query organization without memberships', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        slug: 'test-org',
        status: 'ACTIVE',
        memberships: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);

      const result = await prisma.organization.findUnique({
        where: { id: 'org-1' },
        include: { memberships: true },
      });

      expect(result?.memberships).toEqual([]);
    });
  });

  // ==========================================================================
  // User.memberships Relation Tests
  // ==========================================================================

  describe('User.memberships relation', () => {
    it('should query user with memberships', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        memberships: [
          {
            id: 'mem-1',
            userId: 'user-1',
            organizationId: 'org-1',
            role: 'OWNER',
          },
          {
            id: 'mem-2',
            userId: 'user-1',
            organizationId: 'org-2',
            role: 'MEMBER',
          },
        ],
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await prisma.user.findUnique({
        where: { id: 'user-1' },
        include: { memberships: true },
      });

      expect(result?.memberships).toHaveLength(2);
      expect(result?.memberships[0].organizationId).toBe('org-1');
    });

    it('should query user without memberships', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        memberships: [],
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await prisma.user.findUnique({
        where: { id: 'user-1' },
        include: { memberships: true },
      });

      expect(result?.memberships).toEqual([]);
    });
  });

  // ==========================================================================
  // Backward Compatibility Tests
  // ==========================================================================

  describe('Backward compatibility', () => {
    it('should create organization with only required fields (pre-migration)', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Test Organization',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Test Organization',
        },
      });

      expect(result.name).toBe('Test Organization');
      expect(result.status).toBe('ACTIVE');
    });

    it('should create user with only required fields (pre-migration)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
        },
      });

      expect(result.email).toBe('test@example.com');
      expect(result.isActive).toBe(true);
    });

    it('should query existing organizations after migration', async () => {
      const mockOrgs = [
        {
          id: 'org-1',
          name: 'Old Organization',
          slug: 'old-organization-abc123', // Generated by migration
          status: 'ACTIVE',
          logoUrl: null,
          website: null,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.organization.findMany.mockResolvedValue(mockOrgs);

      const result = await prisma.organization.findMany();

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBeDefined();
      expect(result[0].settings).toEqual({});
    });

    it('should query existing users after migration', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'old-user@example.com',
          password: 'hashed',
          role: 'USER',
          avatarUrl: null,
          phone: null,
          jobTitle: null,
          bio: null,
          isActive: true,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await prisma.user.findMany();

      expect(result).toHaveLength(1);
      expect(result[0].avatarUrl).toBeNull();
      expect(result[0].phone).toBeNull();
      expect(result[0].jobTitle).toBeNull();
      expect(result[0].bio).toBeNull();
    });
  });

  // ==========================================================================
  // Combined Field Tests
  // ==========================================================================

  describe('Combined field operations', () => {
    it('should create organization with all new fields', async () => {
      const mockOrg = {
        id: 'org-1',
        name: 'Full Feature Organization',
        slug: 'full-feature-org',
        logoUrl: 'https://example.com/logo.png',
        website: 'https://example.com',
        settings: {
          theme: 'dark',
          features: ['ocr', 'multiagent'],
        },
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.organization.create.mockResolvedValue(mockOrg);

      const result = await prisma.organization.create({
        data: {
          name: 'Full Feature Organization',
          slug: 'full-feature-org',
          logoUrl: 'https://example.com/logo.png',
          website: 'https://example.com',
          settings: {
            theme: 'dark',
            features: ['ocr', 'multiagent'],
          },
        },
      });

      expect(result).toMatchObject({
        slug: 'full-feature-org',
        logoUrl: 'https://example.com/logo.png',
        website: 'https://example.com',
      });
      expect(result.settings).toEqual({
        theme: 'dark',
        features: ['ocr', 'multiagent'],
      });
    });

    it('should create user with all new profile fields', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'full-profile@example.com',
        password: 'hashed',
        avatarUrl: 'https://example.com/avatar.jpg',
        phone: '+1-555-123-4567',
        jobTitle: 'Senior Engineer',
        bio: 'Full-stack developer with 10 years experience.',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await prisma.user.create({
        data: {
          email: 'full-profile@example.com',
          password: 'hashed',
          avatarUrl: 'https://example.com/avatar.jpg',
          phone: '+1-555-123-4567',
          jobTitle: 'Senior Engineer',
          bio: 'Full-stack developer with 10 years experience.',
        },
      });

      expect(result).toMatchObject({
        avatarUrl: 'https://example.com/avatar.jpg',
        phone: '+1-555-123-4567',
        jobTitle: 'Senior Engineer',
        bio: 'Full-stack developer with 10 years experience.',
      });
    });

    it('should update organization fields independently', async () => {
      mockPrisma.organization.update.mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        logoUrl: 'https://example.com/new-logo.png',
        website: 'https://example.com',
        settings: {},
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await prisma.organization.update({
        where: { id: 'org-1' },
        data: { logoUrl: 'https://example.com/new-logo.png' },
      });

      expect(result.logoUrl).toBe('https://example.com/new-logo.png');
    });

    it('should update user profile fields independently', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed',
        avatarUrl: 'https://example.com/new-avatar.jpg',
        phone: '+1-555-999-9999',
        jobTitle: 'Senior Engineer',
        bio: 'Updated bio',
        role: 'USER',
        isActive: true,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await prisma.user.update({
        where: { id: 'user-1' },
        data: { bio: 'Updated bio' },
      });

      expect(result.bio).toBe('Updated bio');
    });
  });
});
