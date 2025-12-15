import { PrismaClient } from '@prisma/client';
import { encryptJSON } from '../src/utils/encryption';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // ============================================================================
  // ORGANIZATIONS - Required for multi-tenancy and Vector Search
  // ============================================================================

  // Create default organization for existing users
  const defaultOrg = await prisma.organization.upsert({
    where: { id: 'default-organization' },
    update: {},
    create: {
      id: 'default-organization',
      name: 'Default Organization',
      status: 'ACTIVE'
    }
  });

  console.log('Default organization created:', defaultOrg.id);

  // Create test organization for development/testing
  const testOrg = await prisma.organization.upsert({
    where: { id: 'test-organization' },
    update: {},
    create: {
      id: 'test-organization',
      name: 'Test Organization',
      status: 'ACTIVE'
    }
  });

  console.log('Test organization created:', testOrg.id);

  // ============================================================================
  // USERS
  // ============================================================================

  // Create a system user for public templates
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@intellifill.app' },
    update: {
      organizationId: defaultOrg.id
    },
    create: {
      email: 'system@intellifill.app',
      password: 'system-generated-password-not-used',
      firstName: 'IntelliFill',
      lastName: 'System',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      organizationId: defaultOrg.id
    }
  });

  console.log('System user created:', systemUser.id);

  // Create demo user for testing
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: hashedPassword,
      isActive: true,
      emailVerified: true,
      organizationId: defaultOrg.id
    },
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      organizationId: defaultOrg.id
    }
  });

  console.log('Demo user created:', demoUser.email, '(password: admin123)');

  // Create E2E test users (for docker-compose.e2e.yml)
  const testPassword = await bcrypt.hash('Test123!@#', 10);
  const testUser = await prisma.user.upsert({
    where: { email: 'test@intellifill.local' },
    update: {
      password: testPassword,
      isActive: true,
      emailVerified: true,
      organizationId: testOrg.id
    },
    create: {
      email: 'test@intellifill.local',
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'USER',
      isActive: true,
      emailVerified: true,
      organizationId: testOrg.id
    }
  });
  console.log('Test user created:', testUser.email, '(password: Test123!@#)');

  const adminPassword = await bcrypt.hash('Admin123!@#', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@intellifill.local' },
    update: {
      password: adminPassword,
      isActive: true,
      emailVerified: true,
      organizationId: testOrg.id
    },
    create: {
      email: 'admin@intellifill.local',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isActive: true,
      emailVerified: true,
      organizationId: testOrg.id
    }
  });
  console.log('Admin user created:', adminUser.email, '(password: Admin123!@#)');

  // Define pre-loaded templates
  const templates = [
    {
      name: 'W-2 Wage and Tax Statement',
      description: 'Standard IRS Form W-2 for reporting wages and taxes withheld',
      formType: 'W2',
      isPublic: true,
      fieldMappings: [
        { sourceField: 'employer_ein', targetField: 'employer_ein', confidence: 1.0 },
        { sourceField: 'employer_name', targetField: 'employer_name', confidence: 1.0 },
        { sourceField: 'employer_address', targetField: 'employer_address', confidence: 1.0 },
        { sourceField: 'employee_ssn', targetField: 'employee_ssn', confidence: 1.0 },
        { sourceField: 'employee_first_name', targetField: 'first_name', confidence: 1.0 },
        { sourceField: 'employee_last_name', targetField: 'last_name', confidence: 1.0 },
        { sourceField: 'employee_address', targetField: 'address', confidence: 1.0 },
        { sourceField: 'wages_tips', targetField: 'box_1', confidence: 1.0 },
        { sourceField: 'federal_income_tax', targetField: 'box_2', confidence: 1.0 },
        { sourceField: 'social_security_wages', targetField: 'box_3', confidence: 1.0 },
        { sourceField: 'social_security_tax', targetField: 'box_4', confidence: 1.0 },
        { sourceField: 'medicare_wages', targetField: 'box_5', confidence: 1.0 },
        { sourceField: 'medicare_tax', targetField: 'box_6', confidence: 1.0 },
        { sourceField: 'state', targetField: 'box_15', confidence: 1.0 },
        { sourceField: 'state_wages', targetField: 'box_16', confidence: 1.0 },
        { sourceField: 'state_income_tax', targetField: 'box_17', confidence: 1.0 }
      ]
    },
    {
      name: 'I-9 Employment Eligibility Verification',
      description: 'USCIS Form I-9 for verifying identity and employment authorization',
      formType: 'I9',
      isPublic: true,
      fieldMappings: [
        { sourceField: 'last_name', targetField: 'last_name', confidence: 1.0 },
        { sourceField: 'first_name', targetField: 'first_name', confidence: 1.0 },
        { sourceField: 'middle_initial', targetField: 'middle_initial', confidence: 1.0 },
        { sourceField: 'other_names', targetField: 'other_names', confidence: 0.8 },
        { sourceField: 'address', targetField: 'address', confidence: 1.0 },
        { sourceField: 'city', targetField: 'city', confidence: 1.0 },
        { sourceField: 'state', targetField: 'state', confidence: 1.0 },
        { sourceField: 'zip_code', targetField: 'zip_code', confidence: 1.0 },
        { sourceField: 'date_of_birth', targetField: 'date_of_birth', confidence: 1.0 },
        { sourceField: 'social_security_number', targetField: 'ssn', confidence: 1.0 },
        { sourceField: 'email', targetField: 'email', confidence: 0.9 },
        { sourceField: 'phone', targetField: 'phone', confidence: 0.9 },
        { sourceField: 'citizenship_status', targetField: 'citizenship_status', confidence: 1.0 },
        { sourceField: 'alien_number', targetField: 'alien_number', confidence: 0.9 },
        { sourceField: 'i94_number', targetField: 'i94_number', confidence: 0.9 },
        { sourceField: 'passport_number', targetField: 'passport_number', confidence: 0.9 },
        { sourceField: 'country_of_issuance', targetField: 'country_of_issuance', confidence: 0.9 }
      ]
    },
    {
      name: 'US Passport Application',
      description: 'DS-11 Application for a U.S. Passport',
      formType: 'PASSPORT',
      isPublic: true,
      fieldMappings: [
        { sourceField: 'last_name', targetField: 'last_name', confidence: 1.0 },
        { sourceField: 'first_name', targetField: 'first_name', confidence: 1.0 },
        { sourceField: 'middle_name', targetField: 'middle_name', confidence: 1.0 },
        { sourceField: 'date_of_birth', targetField: 'date_of_birth', confidence: 1.0 },
        { sourceField: 'place_of_birth_city', targetField: 'place_of_birth_city', confidence: 1.0 },
        { sourceField: 'place_of_birth_state', targetField: 'place_of_birth_state', confidence: 1.0 },
        { sourceField: 'place_of_birth_country', targetField: 'place_of_birth_country', confidence: 1.0 },
        { sourceField: 'social_security_number', targetField: 'ssn', confidence: 1.0 },
        { sourceField: 'gender', targetField: 'gender', confidence: 1.0 },
        { sourceField: 'height', targetField: 'height', confidence: 0.9 },
        { sourceField: 'hair_color', targetField: 'hair_color', confidence: 0.8 },
        { sourceField: 'eye_color', targetField: 'eye_color', confidence: 0.8 },
        { sourceField: 'address', targetField: 'mailing_address', confidence: 1.0 },
        { sourceField: 'city', targetField: 'city', confidence: 1.0 },
        { sourceField: 'state', targetField: 'state', confidence: 1.0 },
        { sourceField: 'zip_code', targetField: 'zip_code', confidence: 1.0 },
        { sourceField: 'phone', targetField: 'phone', confidence: 1.0 },
        { sourceField: 'email', targetField: 'email', confidence: 1.0 },
        { sourceField: 'emergency_contact_name', targetField: 'emergency_contact_name', confidence: 0.9 },
        { sourceField: 'emergency_contact_phone', targetField: 'emergency_contact_phone', confidence: 0.9 },
        { sourceField: 'emergency_contact_address', targetField: 'emergency_contact_address', confidence: 0.9 }
      ]
    },
    {
      name: 'Job Application Form',
      description: 'Standard job application form for employment',
      formType: 'JOB_APPLICATION',
      isPublic: true,
      fieldMappings: [
        { sourceField: 'first_name', targetField: 'first_name', confidence: 1.0 },
        { sourceField: 'last_name', targetField: 'last_name', confidence: 1.0 },
        { sourceField: 'middle_name', targetField: 'middle_name', confidence: 0.9 },
        { sourceField: 'email', targetField: 'email', confidence: 1.0 },
        { sourceField: 'phone', targetField: 'phone', confidence: 1.0 },
        { sourceField: 'address', targetField: 'address', confidence: 1.0 },
        { sourceField: 'city', targetField: 'city', confidence: 1.0 },
        { sourceField: 'state', targetField: 'state', confidence: 1.0 },
        { sourceField: 'zip_code', targetField: 'zip_code', confidence: 1.0 },
        { sourceField: 'date_of_birth', targetField: 'date_of_birth', confidence: 0.8 },
        { sourceField: 'social_security_number', targetField: 'ssn', confidence: 0.9 },
        { sourceField: 'position_applied_for', targetField: 'position', confidence: 1.0 },
        { sourceField: 'available_start_date', targetField: 'start_date', confidence: 0.9 },
        { sourceField: 'salary_expected', targetField: 'salary_expected', confidence: 0.8 },
        { sourceField: 'employment_desired', targetField: 'employment_type', confidence: 0.9 },
        { sourceField: 'education_high_school', targetField: 'high_school', confidence: 0.8 },
        { sourceField: 'education_college', targetField: 'college', confidence: 0.8 },
        { sourceField: 'degree', targetField: 'degree', confidence: 0.8 },
        { sourceField: 'major', targetField: 'major', confidence: 0.8 },
        { sourceField: 'previous_employer', targetField: 'previous_employer', confidence: 0.9 },
        { sourceField: 'job_title', targetField: 'previous_job_title', confidence: 0.9 },
        { sourceField: 'employment_dates', targetField: 'employment_dates', confidence: 0.9 },
        { sourceField: 'references', targetField: 'references', confidence: 0.7 }
      ]
    }
  ];

  // Create templates
  for (const template of templates) {
    const encryptedMappings = encryptJSON(template.fieldMappings);

    const created = await prisma.template.upsert({
      where: {
        id: `seed-${template.formType.toLowerCase()}`
      },
      update: {
        name: template.name,
        description: template.description,
        formType: template.formType,
        fieldMappings: encryptedMappings,
        isPublic: template.isPublic
      },
      create: {
        id: `seed-${template.formType.toLowerCase()}`,
        userId: systemUser.id,
        name: template.name,
        description: template.description,
        formType: template.formType,
        fieldMappings: encryptedMappings,
        isPublic: template.isPublic,
        usageCount: 0
      }
    });

    console.log(`Template created: ${created.name} (${created.formType})`);
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
