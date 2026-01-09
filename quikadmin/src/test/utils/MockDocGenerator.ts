/**
 * Mock Document Generator Utility
 *
 * Generates dynamic mock text and document structures for unit tests.
 * Used by DataExtractor, DocumentDetection, and FieldMapper tests.
 */

export interface MockDocumentOptions {
  includePassport?: boolean;
  includeEmiratesId?: boolean;
  includeTradeLicense?: boolean;
  includeVisa?: boolean;
  includePersonalInfo?: boolean;
  includeAddresses?: boolean;
  includePhoneNumbers?: boolean;
  includeEmails?: boolean;
  ocrQuality?: 'high' | 'medium' | 'low';
}

export interface MockPersonData {
  firstName: string;
  lastName: string;
  fullName: string;
  title?: string;
  dateOfBirth: string;
  nationality: string;
  email: string;
  phone: string;
  address: string;
}

export interface MockPassportData {
  passportNumber: string;
  expiryDate: string;
  issueDate: string;
  issuingCountry: string;
  mrz: string;
}

export interface MockEmiratesIdData {
  emiratesId: string;
  expiryDate: string;
}

export interface MockTradeLicenseData {
  licenseNumber: string;
  companyName: string;
  activities: string[];
  expiryDate: string;
}

export class MockDocGenerator {
  private static readonly FIRST_NAMES = ['John', 'Jane', 'Mohammed', 'Fatima', 'Ahmed', 'Sarah'];
  private static readonly LAST_NAMES = ['Doe', 'Smith', 'Al-Rashid', 'Johnson', 'Khan', 'Williams'];
  private static readonly TITLES = ['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.', 'Eng.'];
  private static readonly NATIONALITIES = ['USA', 'UAE', 'UK', 'India', 'Pakistan', 'Egypt'];
  private static readonly COUNTRIES = ['United States', 'United Arab Emirates', 'United Kingdom'];

  /**
   * Generate a random person's data
   */
  static generatePerson(options: { withTitle?: boolean } = {}): MockPersonData {
    const firstName = this.randomFrom(this.FIRST_NAMES);
    const lastName = this.randomFrom(this.LAST_NAMES);
    const title = options.withTitle ? this.randomFrom(this.TITLES) : undefined;

    return {
      firstName,
      lastName,
      fullName: title ? `${title} ${firstName} ${lastName}` : `${firstName} ${lastName}`,
      title,
      dateOfBirth: this.randomDate(1960, 2000),
      nationality: this.randomFrom(this.NATIONALITIES),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: this.generateUSPhone(),
      address: this.generateAddress(),
    };
  }

  /**
   * Generate passport data with MRZ
   */
  static generatePassport(person?: MockPersonData): MockPassportData {
    const p = person || this.generatePerson();
    const passportNumber = `P${this.randomDigits(7)}`;
    const expiryDate = this.randomDate(2025, 2035);
    const issueDate = this.randomDate(2020, 2024);
    const country = this.randomFrom(this.COUNTRIES);

    // Generate MRZ (simplified - two lines of 44 characters each)
    const lastName = p.lastName.toUpperCase().padEnd(39, '<');
    const firstName = p.firstName.toUpperCase();
    const mrz1 = `P<${country.substring(0, 3).toUpperCase()}${lastName}<<${firstName}`;
    const mrz2 = `${passportNumber}<${p.nationality.substring(0, 3)}${expiryDate.replace(/-/g, '')}`;

    return {
      passportNumber,
      expiryDate,
      issueDate,
      issuingCountry: country,
      mrz: `${mrz1.substring(0, 44)}\n${mrz2.padEnd(44, '<')}`,
    };
  }

  /**
   * Generate Emirates ID data
   */
  static generateEmiratesId(): MockEmiratesIdData {
    return {
      emiratesId: `784-${this.randomDigits(4)}-${this.randomDigits(7)}-${this.randomDigits(1)}`,
      expiryDate: this.randomDate(2025, 2035),
    };
  }

  /**
   * Generate Trade License data
   */
  static generateTradeLicense(): MockTradeLicenseData {
    const activities = [
      'General Trading',
      'IT Consulting',
      'Management Consultancy',
      'Import/Export',
      'Software Development',
    ];

    return {
      licenseNumber: `TL-${this.randomDigits(6)}`,
      companyName: `${this.randomFrom(this.LAST_NAMES)} ${this.randomFrom(['LLC', 'Inc', 'Corp', 'Trading'])}`,
      activities: [this.randomFrom(activities), this.randomFrom(activities)],
      expiryDate: this.randomDate(2025, 2030),
    };
  }

  /**
   * Generate US phone number
   */
  static generateUSPhone(): string {
    return `(${this.randomDigits(3)}) ${this.randomDigits(3)}-${this.randomDigits(4)}`;
  }

  /**
   * Generate international phone number
   */
  static generateInternationalPhone(countryCode: string = '+971'): string {
    return `${countryCode} ${this.randomDigits(2)} ${this.randomDigits(3)} ${this.randomDigits(4)}`;
  }

  /**
   * Generate a US address
   */
  static generateAddress(): string {
    const streetNum = Math.floor(Math.random() * 9999) + 1;
    const streets = ['Main St', 'Oak Ave', 'Park Blvd', 'First St', 'Cedar Lane'];
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];
    const idx = Math.floor(Math.random() * 5);

    return `${streetNum} ${this.randomFrom(streets)}\n${cities[idx]}, ${states[idx]} ${this.randomDigits(5)}`;
  }

  /**
   * Generate a complete document text based on options
   */
  static generateDocumentText(options: MockDocumentOptions = {}): string {
    const parts: string[] = [];
    const person = this.generatePerson({ withTitle: true });

    if (options.includePersonalInfo !== false) {
      parts.push(`Name: ${person.fullName}`);
      parts.push(`Date of Birth: ${person.dateOfBirth}`);
      parts.push(`Nationality: ${person.nationality}`);
    }

    if (options.includeEmails !== false) {
      parts.push(`Email: ${person.email}`);
    }

    if (options.includePhoneNumbers !== false) {
      parts.push(`Phone: ${person.phone}`);
      parts.push(`Mobile: ${this.generateInternationalPhone()}`);
    }

    if (options.includeAddresses !== false) {
      parts.push(`Address:\n${person.address}`);
    }

    if (options.includePassport) {
      const passport = this.generatePassport(person);
      parts.push(`\n--- PASSPORT ---`);
      parts.push(`Passport No: ${passport.passportNumber}`);
      parts.push(`Issue Date: ${passport.issueDate}`);
      parts.push(`Expiry Date: ${passport.expiryDate}`);
      parts.push(`Issuing Country: ${passport.issuingCountry}`);
      parts.push(`MRZ:\n${passport.mrz}`);
    }

    if (options.includeEmiratesId) {
      const eid = this.generateEmiratesId();
      parts.push(`\n--- EMIRATES ID ---`);
      parts.push(`Emirates ID: ${eid.emiratesId}`);
      parts.push(`Expiry: ${eid.expiryDate}`);
    }

    if (options.includeTradeLicense) {
      const license = this.generateTradeLicense();
      parts.push(`\n--- TRADE LICENSE ---`);
      parts.push(`License No: ${license.licenseNumber}`);
      parts.push(`Company: ${license.companyName}`);
      parts.push(`Activities: ${license.activities.join(', ')}`);
      parts.push(`Valid Until: ${license.expiryDate}`);
    }

    // Apply OCR quality simulation
    let text = parts.join('\n');
    if (options.ocrQuality === 'low') {
      text = this.simulateLowQualityOCR(text);
    } else if (options.ocrQuality === 'medium') {
      text = this.simulateMediumQualityOCR(text);
    }

    return text;
  }

  /**
   * Simulate low quality OCR with common substitutions
   */
  private static simulateLowQualityOCR(text: string): string {
    return text
      .replace(/O/g, '0')  // O -> 0
      .replace(/l/g, '1')  // l -> 1
      .replace(/I/g, '|')  // I -> |
      .replace(/S/g, '5')  // S -> 5
      .replace(/\s+/g, (m) => m + (Math.random() > 0.8 ? ' ' : '')); // Random extra spaces
  }

  /**
   * Simulate medium quality OCR with occasional errors
   */
  private static simulateMediumQualityOCR(text: string): string {
    return text
      .replace(/O/g, (m) => Math.random() > 0.7 ? '0' : m)
      .replace(/l/g, (m) => Math.random() > 0.7 ? '1' : m);
  }

  /**
   * Generate random digits string
   */
  private static randomDigits(length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  }

  /**
   * Generate random date string (YYYY-MM-DD)
   */
  private static randomDate(startYear: number, endYear: number): string {
    const year = startYear + Math.floor(Math.random() * (endYear - startYear));
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Pick random element from array
   */
  private static randomFrom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

export default MockDocGenerator;
