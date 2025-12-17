/**
 * Demo Seed Script - Creates demo data for IntelliFill showcases
 *
 * Run with: npx prisma db seed -- --demo
 * Or directly: npx ts-node prisma/seed-demo.ts
 *
 * Creates:
 * - Demo organization and user (demo@intellifill.com / demo123)
 * - Sample UAE clients with realistic profiles
 * - UAE-specific form templates (visa, company formation)
 * - Sample documents with OCR-extracted data
 */

import { PrismaClient, DocumentCategory, FormCategory, DocumentStatus, ClientStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { encryptJSON } from '../src/utils/encryption';

const prisma = new PrismaClient();

// Demo credentials
const DEMO_EMAIL = 'demo@intellifill.com';
const DEMO_PASSWORD = 'demo123';
const DEMO_ORG_NAME = 'Demo PRO Agency';

// Sample UAE client data
const UAE_CLIENTS = [
  {
    name: 'Ahmed Al-Rashid',
    email: 'ahmed.rashid@example.com',
    phone: '+971501234567',
    profile: {
      firstName: 'Ahmed',
      lastName: 'Al-Rashid',
      dateOfBirth: '1985-03-15',
      nationality: 'Pakistan',
      passportNumber: 'AB1234567',
      passportExpiry: '2028-06-20',
      emiratesId: '784-1985-1234567-1',
      emiratesIdExpiry: '2026-12-31',
      visaNumber: 'DXB-2024-123456',
      visaType: 'Employment Visa',
      visaExpiry: '2026-03-15',
      employer: 'Tech Solutions LLC',
      occupation: 'Software Engineer',
      salary: '25000',
      address: 'Apartment 1205, Marina Tower, Dubai Marina',
      emirate: 'Dubai',
    },
    documents: [
      {
        fileName: 'ahmed_passport.pdf',
        category: DocumentCategory.PASSPORT,
        confidence: 0.94,
        extractedData: {
          fullName: 'AHMED AL-RASHID',
          passportNumber: 'AB1234567',
          nationality: 'PAKISTAN',
          dateOfBirth: '15 MAR 1985',
          dateOfIssue: '20 JUN 2023',
          dateOfExpiry: '20 JUN 2028',
          placeOfIssue: 'ISLAMABAD',
          gender: 'MALE',
        },
      },
      {
        fileName: 'ahmed_emirates_id.pdf',
        category: DocumentCategory.EMIRATES_ID,
        confidence: 0.91,
        extractedData: {
          idNumber: '784-1985-1234567-1',
          name: 'AHMED AL-RASHID',
          nationality: 'PAKISTAN',
          dateOfBirth: '15/03/1985',
          expiryDate: '31/12/2026',
          cardNumber: 'ID123456789',
          gender: 'M',
        },
      },
    ],
  },
  {
    name: 'Fatima Hassan',
    email: 'fatima.hassan@example.com',
    phone: '+971551234567',
    profile: {
      firstName: 'Fatima',
      lastName: 'Hassan',
      dateOfBirth: '1990-07-22',
      nationality: 'Egypt',
      passportNumber: 'A12345678',
      passportExpiry: '2027-09-10',
      emiratesId: '784-1990-7654321-2',
      emiratesIdExpiry: '2025-06-30',
      visaNumber: 'ABD-2023-654321',
      visaType: 'Investor Visa',
      visaExpiry: '2025-07-22',
      companyName: 'Fatima Trading LLC',
      tradeLicense: 'TL-2023-12345',
      tradeLicenseExpiry: '2025-12-31',
      address: 'Villa 45, Al Reem Island, Abu Dhabi',
      emirate: 'Abu Dhabi',
    },
    documents: [
      {
        fileName: 'fatima_passport.pdf',
        category: DocumentCategory.PASSPORT,
        confidence: 0.88,
        extractedData: {
          fullName: 'FATIMA HASSAN',
          passportNumber: 'A12345678',
          nationality: 'EGYPT',
          dateOfBirth: '22 JUL 1990',
          dateOfIssue: '10 SEP 2022',
          dateOfExpiry: '10 SEP 2027',
          placeOfIssue: 'CAIRO',
          gender: 'FEMALE',
        },
      },
      {
        fileName: 'fatima_trade_license.pdf',
        category: DocumentCategory.TRADE_LICENSE,
        confidence: 0.72, // Lower confidence to demo the alert
        extractedData: {
          licenseNumber: 'TL-2023-12345',
          companyName: 'FATIMA TRADING LLC',
          activity: 'GENERAL TRADING',
          issueDate: '01/01/2023',
          expiryDate: '31/12/2025',
          legalForm: 'LIMITED LIABILITY COMPANY',
          capital: 'AED 300,000',
          partners: 'FATIMA HASSAN (100%)',
        },
      },
      {
        fileName: 'fatima_emirates_id.pdf',
        category: DocumentCategory.EMIRATES_ID,
        confidence: 0.45, // Very low confidence to demo critical alert
        extractedData: {
          idNumber: '784-1990-7654321-2',
          name: 'FATIMA HASSAN',
          nationality: 'EGYPT',
          // Some fields missing due to low quality scan
        },
      },
    ],
  },
  {
    name: 'Mohammed Khan',
    email: 'mohammed.khan@example.com',
    phone: '+971561234567',
    profile: {
      firstName: 'Mohammed',
      lastName: 'Khan',
      dateOfBirth: '1978-11-05',
      nationality: 'India',
      passportNumber: 'J98765432',
      passportExpiry: '2029-02-15',
      emiratesId: '784-1978-9876543-3',
      emiratesIdExpiry: '2027-08-15',
      visaNumber: 'SHJ-2024-789012',
      visaType: 'Family Visa',
      visaExpiry: '2026-11-05',
      sponsor: 'Khalid Enterprises LLC',
      address: 'Flat 302, Al Nahda Building, Sharjah',
      emirate: 'Sharjah',
    },
    documents: [
      {
        fileName: 'mohammed_passport.pdf',
        category: DocumentCategory.PASSPORT,
        confidence: 0.96,
        extractedData: {
          fullName: 'MOHAMMED KHAN',
          passportNumber: 'J98765432',
          nationality: 'INDIA',
          dateOfBirth: '05 NOV 1978',
          dateOfIssue: '15 FEB 2024',
          dateOfExpiry: '15 FEB 2029',
          placeOfIssue: 'MUMBAI',
          gender: 'MALE',
        },
      },
    ],
  },
];

// UAE Form Templates
const UAE_FORM_TEMPLATES = [
  {
    name: 'UAE Residence Visa Application',
    description: 'Standard application form for UAE residence visa',
    category: FormCategory.VISA,
    fields: [
      { name: 'applicant_name', label: 'Applicant Full Name', type: 'text', required: true },
      { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
      { name: 'nationality', label: 'Nationality', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true },
      { name: 'visa_type', label: 'Visa Type', type: 'select', options: ['Employment', 'Investor', 'Family', 'Student'], required: true },
      { name: 'sponsor_name', label: 'Sponsor Name', type: 'text', required: true },
      { name: 'sponsor_id', label: 'Sponsor Emirates ID', type: 'text', required: true },
      { name: 'entry_date', label: 'Entry Date to UAE', type: 'date', required: true },
      { name: 'current_address', label: 'Current Address in UAE', type: 'textarea', required: true },
      { name: 'emirates_id', label: 'Emirates ID (if existing)', type: 'text', required: false },
      { name: 'previous_visa', label: 'Previous Visa Number', type: 'text', required: false },
    ],
    fieldMappings: {
      applicant_name: ['fullName', 'name', 'applicantName'],
      passport_number: ['passportNumber', 'passport_number', 'passport'],
      nationality: ['nationality', 'country'],
      date_of_birth: ['dateOfBirth', 'dob', 'birthDate'],
      gender: ['gender', 'sex'],
      emirates_id: ['idNumber', 'emiratesId', 'eid'],
    },
  },
  {
    name: 'UAE Company Formation - MOE',
    description: 'Ministry of Economy company formation application',
    category: FormCategory.COMPANY_FORMATION,
    fields: [
      { name: 'company_name', label: 'Proposed Company Name', type: 'text', required: true },
      { name: 'legal_form', label: 'Legal Form', type: 'select', options: ['LLC', 'Sole Establishment', 'Civil Company'], required: true },
      { name: 'business_activity', label: 'Business Activity', type: 'text', required: true },
      { name: 'share_capital', label: 'Share Capital (AED)', type: 'number', required: true },
      { name: 'partner_1_name', label: 'Partner 1 Name', type: 'text', required: true },
      { name: 'partner_1_nationality', label: 'Partner 1 Nationality', type: 'text', required: true },
      { name: 'partner_1_passport', label: 'Partner 1 Passport', type: 'text', required: true },
      { name: 'partner_1_share', label: 'Partner 1 Share %', type: 'number', required: true },
      { name: 'office_address', label: 'Registered Office Address', type: 'textarea', required: true },
      { name: 'emirate', label: 'Emirate', type: 'select', options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UAQ'], required: true },
    ],
    fieldMappings: {
      company_name: ['companyName', 'company_name', 'tradeName'],
      legal_form: ['legalForm', 'companyType'],
      business_activity: ['activity', 'businessActivity'],
      share_capital: ['capital', 'shareCapital'],
      partner_1_name: ['fullName', 'name', 'partnerName'],
      partner_1_nationality: ['nationality'],
      partner_1_passport: ['passportNumber', 'passport'],
    },
  },
  {
    name: 'UAE Labor Card Application',
    description: 'Ministry of Human Resources labor card application',
    category: FormCategory.LABOR,
    fields: [
      { name: 'employee_name', label: 'Employee Full Name', type: 'text', required: true },
      { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
      { name: 'emirates_id', label: 'Emirates ID', type: 'text', required: true },
      { name: 'nationality', label: 'Nationality', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'job_title', label: 'Job Title', type: 'text', required: true },
      { name: 'salary', label: 'Basic Salary (AED)', type: 'number', required: true },
      { name: 'employer_name', label: 'Employer/Company Name', type: 'text', required: true },
      { name: 'employer_license', label: 'Employer Trade License No.', type: 'text', required: true },
      { name: 'contract_type', label: 'Contract Type', type: 'select', options: ['Limited', 'Unlimited'], required: true },
      { name: 'work_location', label: 'Work Location', type: 'text', required: true },
    ],
    fieldMappings: {
      employee_name: ['fullName', 'name', 'employeeName'],
      passport_number: ['passportNumber', 'passport'],
      emirates_id: ['idNumber', 'emiratesId', 'eid'],
      nationality: ['nationality'],
      date_of_birth: ['dateOfBirth', 'dob'],
      job_title: ['occupation', 'jobTitle', 'position'],
      salary: ['salary', 'basicSalary'],
      employer_name: ['employer', 'companyName', 'employerName'],
    },
  },
  {
    name: 'Emirates ID Renewal Application',
    description: 'Federal Authority for Identity renewal form',
    category: FormCategory.IMMIGRATION,
    fields: [
      { name: 'current_eid', label: 'Current Emirates ID Number', type: 'text', required: true },
      { name: 'full_name', label: 'Full Name (as per passport)', type: 'text', required: true },
      { name: 'passport_number', label: 'Passport Number', type: 'text', required: true },
      { name: 'nationality', label: 'Nationality', type: 'text', required: true },
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female'], required: true },
      { name: 'visa_file_number', label: 'Visa/Unified Number', type: 'text', required: true },
      { name: 'contact_mobile', label: 'Mobile Number', type: 'text', required: true },
      { name: 'contact_email', label: 'Email Address', type: 'email', required: true },
      { name: 'delivery_emirate', label: 'Card Delivery Emirate', type: 'select', options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'RAK', 'Fujairah', 'UAQ'], required: true },
    ],
    fieldMappings: {
      current_eid: ['idNumber', 'emiratesId', 'eid'],
      full_name: ['fullName', 'name'],
      passport_number: ['passportNumber', 'passport'],
      nationality: ['nationality'],
      date_of_birth: ['dateOfBirth', 'dob'],
      gender: ['gender', 'sex'],
    },
  },
];

async function main() {
  console.log('🌱 Starting demo data seed...\n');

  // 1. Create Demo Organization
  console.log('📦 Creating demo organization...');
  const demoOrg = await prisma.organization.upsert({
    where: { name: DEMO_ORG_NAME },
    update: {},
    create: {
      name: DEMO_ORG_NAME,
      settings: {
        defaultCurrency: 'AED',
        timezone: 'Asia/Dubai',
        language: 'en',
        features: {
          ocrEnabled: true,
          autoFillEnabled: true,
          vectorSearchEnabled: true,
        },
      },
    },
  });
  console.log(`   ✓ Organization: ${demoOrg.name} (${demoOrg.id})`);

  // 2. Create Demo User
  console.log('👤 Creating demo user...');
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      password: hashedPassword,
      organizationId: demoOrg.id,
    },
    create: {
      email: DEMO_EMAIL,
      password: hashedPassword,
      name: 'Demo User',
      role: 'ADMIN',
      organizationId: demoOrg.id,
      isActive: true,
      emailVerified: new Date(),
    },
  });
  console.log(`   ✓ User: ${demoUser.email} (password: ${DEMO_PASSWORD})`);

  // 3. Create Form Templates
  console.log('📋 Creating UAE form templates...');
  for (const template of UAE_FORM_TEMPLATES) {
    const encryptedMappings = template.fieldMappings
      ? encryptJSON(template.fieldMappings)
      : null;

    const created = await prisma.formTemplate.upsert({
      where: {
        organizationId_name: {
          organizationId: demoOrg.id,
          name: template.name,
        },
      },
      update: {
        description: template.description,
        category: template.category,
        fields: template.fields,
        fieldMappings: encryptedMappings,
        isActive: true,
      },
      create: {
        name: template.name,
        description: template.description,
        category: template.category,
        fields: template.fields,
        fieldMappings: encryptedMappings,
        organizationId: demoOrg.id,
        createdById: demoUser.id,
        isActive: true,
      },
    });
    console.log(`   ✓ Template: ${created.name}`);
  }

  // 4. Create Clients and Documents
  console.log('👥 Creating UAE clients with documents...');
  for (const clientData of UAE_CLIENTS) {
    // Create client
    const client = await prisma.client.upsert({
      where: {
        organizationId_email: {
          organizationId: demoOrg.id,
          email: clientData.email,
        },
      },
      update: {
        name: clientData.name,
        phone: clientData.phone,
        status: ClientStatus.ACTIVE,
      },
      create: {
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        status: ClientStatus.ACTIVE,
        organizationId: demoOrg.id,
        createdById: demoUser.id,
      },
    });
    console.log(`   ✓ Client: ${client.name}`);

    // Create or update client profile
    const encryptedProfile = encryptJSON(clientData.profile);
    await prisma.clientProfile.upsert({
      where: { clientId: client.id },
      update: {
        data: encryptedProfile,
        updatedAt: new Date(),
      },
      create: {
        clientId: client.id,
        data: encryptedProfile,
      },
    });
    console.log(`      ✓ Profile created`);

    // Create documents with extracted data
    for (const doc of clientData.documents) {
      const document = await prisma.clientDocument.upsert({
        where: {
          clientId_fileName: {
            clientId: client.id,
            fileName: doc.fileName,
          },
        },
        update: {
          category: doc.category,
          status: DocumentStatus.COMPLETED,
          processedAt: new Date(),
        },
        create: {
          fileName: doc.fileName,
          fileType: 'application/pdf',
          fileSize: Math.floor(Math.random() * 500000) + 100000, // 100KB - 600KB
          storagePath: `demo/${client.id}/${doc.fileName}`,
          category: doc.category,
          status: DocumentStatus.COMPLETED,
          processedAt: new Date(),
          clientId: client.id,
          uploadedById: demoUser.id,
          organizationId: demoOrg.id,
        },
      });

      // Create extracted data
      const encryptedData = encryptJSON(doc.extractedData);
      await prisma.extractedData.upsert({
        where: { documentId: document.id },
        update: {
          data: encryptedData,
          confidence: doc.confidence,
          processingTime: Math.floor(Math.random() * 2000) + 500, // 500ms - 2500ms
        },
        create: {
          documentId: document.id,
          data: encryptedData,
          confidence: doc.confidence,
          processingTime: Math.floor(Math.random() * 2000) + 500,
          ocrEngine: 'tesseract',
          version: '1.0.0',
        },
      });

      const confidenceEmoji = doc.confidence >= 0.85 ? '✅' : doc.confidence >= 0.70 ? '⚠️' : '❌';
      console.log(`      ✓ Document: ${doc.fileName} (${Math.round(doc.confidence * 100)}% ${confidenceEmoji})`);
    }
  }

  // 5. Create a sample filled form
  console.log('📄 Creating sample filled form...');
  const visaTemplate = await prisma.formTemplate.findFirst({
    where: {
      organizationId: demoOrg.id,
      name: 'UAE Residence Visa Application',
    },
  });

  const ahmedClient = await prisma.client.findFirst({
    where: {
      organizationId: demoOrg.id,
      name: 'Ahmed Al-Rashid',
    },
  });

  if (visaTemplate && ahmedClient) {
    const filledFormData = {
      applicant_name: 'Ahmed Al-Rashid',
      passport_number: 'AB1234567',
      nationality: 'Pakistan',
      date_of_birth: '1985-03-15',
      gender: 'Male',
      visa_type: 'Employment',
      sponsor_name: 'Tech Solutions LLC',
      sponsor_id: '784-2000-1234567-1',
      entry_date: '2024-01-15',
      current_address: 'Apartment 1205, Marina Tower, Dubai Marina',
      emirates_id: '784-1985-1234567-1',
    };

    await prisma.filledForm.upsert({
      where: {
        id: 'demo-filled-form-001',
      },
      update: {
        data: encryptJSON(filledFormData),
        confidence: 0.92,
      },
      create: {
        id: 'demo-filled-form-001',
        templateId: visaTemplate.id,
        clientId: ahmedClient.id,
        data: encryptJSON(filledFormData),
        confidence: 0.92,
        status: 'DRAFT',
        createdById: demoUser.id,
      },
    });
    console.log(`   ✓ Filled form: Visa application for Ahmed Al-Rashid`);
  }

  console.log('\n✨ Demo data seed completed!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 Demo Login Credentials:');
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n📊 Demo Data Summary:');
  console.log(`   • 1 Demo Organization`);
  console.log(`   • 1 Demo User (Admin)`);
  console.log(`   • ${UAE_FORM_TEMPLATES.length} UAE Form Templates`);
  console.log(`   • ${UAE_CLIENTS.length} Sample Clients`);
  console.log(`   • ${UAE_CLIENTS.reduce((sum, c) => sum + c.documents.length, 0)} Sample Documents`);
  console.log(`   • 1 Pre-filled Form`);
  console.log('\n💡 To run: npx ts-node prisma/seed-demo.ts\n');
}

main()
  .catch((e) => {
    console.error('❌ Demo seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
