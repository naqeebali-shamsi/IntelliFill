/**
 * Field Matcher - Maps detected form fields to user profile data
 *
 * Multi-layer matching strategy:
 * 1. HTML autocomplete attribute (highest confidence)
 * 2. Input type mapping
 * 3. Name/id/label regex patterns
 * 4. Fuzzy string similarity (lowest confidence)
 */

import { FieldType, type DetectedField } from '../shared/types/field-detection';
import type { ProfileField } from '../shared/types/api';
import type { FieldMatch, MatchedField, MatchMethod } from '../shared/types/field-matching';

/** Maps HTML autocomplete attribute values to profile field keys */
const AUTOCOMPLETE_TO_PROFILE: Record<string, string> = {
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  name: 'fullName',
  'honorific-prefix': 'prefix',
  'honorific-suffix': 'suffix',
  nickname: 'nickname',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'tel-local': 'phone',
  'street-address': 'streetAddress',
  'address-line1': 'streetAddress',
  'address-line2': 'streetAddress2',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'zipCode',
  country: 'country',
  'country-name': 'country',
  bday: 'dateOfBirth',
  'bday-day': 'birthDay',
  'bday-month': 'birthMonth',
  'bday-year': 'birthYear',
  sex: 'gender',
  organization: 'company',
  'organization-title': 'jobTitle',
  url: 'website',
  'cc-name': 'cardholderName',
  'cc-number': 'cardNumber',
  'cc-exp': 'cardExpiry',
  'cc-csc': 'cardCVC',
};

/** Maps profile keys to regex patterns that match field names/labels */
const PROFILE_KEY_PATTERNS: Record<string, RegExp> = {
  firstName: /\b(first[-_\s]?name|fname|given[-_\s]?name|forename)\b/i,
  middleName: /\b(middle[-_\s]?name|mname)\b/i,
  lastName: /\b(last[-_\s]?name|lname|family[-_\s]?name|surname)\b/i,
  fullName: /\b(full[-_\s]?name|your[-_\s]?name|name)\b/i,
  email: /\b(e[-_\s]?mail|email[-_\s]?address)\b/i,
  phone: /\b(phone|telephone|tel|mobile|cell[-_\s]?phone|contact[-_\s]?number)\b/i,
  streetAddress: /\b(street|address[-_\s]?1|address[-_\s]?line[-_\s]?1|street[-_\s]?address|mailing[-_\s]?address)\b/i,
  streetAddress2: /\b(address[-_\s]?2|address[-_\s]?line[-_\s]?2|apt|suite|unit)\b/i,
  city: /\b(city|town|municipality|locality)\b/i,
  state: /\b(state|province|region)\b/i,
  zipCode: /\b(zip|zip[-_\s]?code|postal[-_\s]?code|postcode)\b/i,
  country: /\b(country|nation)\b/i,
  dateOfBirth: /\b(date[-_\s]?of[-_\s]?birth|dob|birth[-_\s]?date|birthday)\b/i,
  birthDay: /\b(birth[-_\s]?day|day[-_\s]?of[-_\s]?birth)\b/i,
  birthMonth: /\b(birth[-_\s]?month|month[-_\s]?of[-_\s]?birth)\b/i,
  birthYear: /\b(birth[-_\s]?year|year[-_\s]?of[-_\s]?birth)\b/i,
  gender: /\b(gender|sex)\b/i,
  company: /\b(company|organization|employer|business)\b/i,
  jobTitle: /\b(job[-_\s]?title|title|position|role|occupation)\b/i,
  ssn: /\b(ssn|social[-_\s]?security|tax[-_\s]?id|tin)\b/i,
  website: /\b(website|url|homepage|web[-_\s]?address)\b/i,
  driversLicense: /\b(driver'?s?[-_\s]?licen[sc]e|dl[-_\s]?number)\b/i,
  passportNumber: /\b(passport[-_\s]?number|passport)\b/i,
};

/** Maps FieldType to likely profile keys (for type-based matching) */
const TYPE_TO_PROFILE_KEYS: Partial<Record<FieldType, string[]>> = {
  [FieldType.EMAIL]: ['email'],
  [FieldType.PHONE]: ['phone'],
  [FieldType.DATE]: ['dateOfBirth'],
  [FieldType.SSN]: ['ssn'],
  [FieldType.ADDRESS]: ['streetAddress', 'city', 'state', 'zipCode', 'country'],
};

/** Normalize a string for fuzzy comparison */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_\s]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const rows = b.length + 1;
  const cols = a.length + 1;
  const matrix: number[] = new Array<number>(rows * cols).fill(0);

  for (let i = 0; i < rows; i++) matrix[i * cols] = i;
  for (let j = 0; j < cols; j++) matrix[j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i * cols + j] = Math.min(
        (matrix[(i - 1) * cols + j] ?? 0) + 1,
        (matrix[i * cols + (j - 1)] ?? 0) + 1,
        (matrix[(i - 1) * cols + (j - 1)] ?? 0) + cost,
      );
    }
  }
  return matrix[b.length * cols + a.length] ?? 0;
}

/** Calculate similarity between two strings (0 to 1) */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Build a profile map from profile fields array (key -> best value) */
function buildProfileMap(fields: ProfileField[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const field of fields) {
    const firstValue = field.values[0];
    if (firstValue !== undefined) {
      map.set(field.key, firstValue);
    }
  }
  return map;
}

/** Get all text identifiers for a field (for matching) */
function getFieldTexts(field: DetectedField): string[] {
  const texts: string[] = [];
  if (field.name) texts.push(field.name);
  if (field.label) texts.push(field.label);
  if (field.element.id) texts.push(field.element.id);
  if ((field.element as HTMLInputElement).placeholder) {
    texts.push((field.element as HTMLInputElement).placeholder);
  }
  return texts;
}

/** Match a single field to profile data, returning all possible matches */
function matchField(field: DetectedField, profileMap: Map<string, string>): FieldMatch[] {
  const matches: FieldMatch[] = [];
  const seen = new Set<string>();

  function addMatch(profileField: string, confidence: number, method: MatchMethod): void {
    const value = profileMap.get(profileField);
    if (!value || seen.has(profileField)) return;
    seen.add(profileField);
    matches.push({ profileField, value, confidence, matchMethod: method });
  }

  // Layer 1: Autocomplete attribute
  if (field.autocomplete) {
    const autocompleteKey = field.autocomplete.replace(/^(shipping|billing)\s+/, '').trim();
    const profileKey = AUTOCOMPLETE_TO_PROFILE[autocompleteKey];
    if (profileKey) {
      addMatch(profileKey, 0.95, 'autocomplete');
    }
  }

  // Layer 2: Input type mapping
  const typeKeys = TYPE_TO_PROFILE_KEYS[field.type];
  if (typeKeys) {
    for (const key of typeKeys) {
      addMatch(key, 0.85, 'type');
    }
  }

  // Layer 3: Name/label regex patterns
  const texts = getFieldTexts(field);
  for (const [profileKey, pattern] of Object.entries(PROFILE_KEY_PATTERNS)) {
    for (const text of texts) {
      if (pattern.test(text)) {
        addMatch(profileKey, 0.80, 'name');
        break;
      }
    }
  }

  // Layer 4: Fuzzy matching (only if no high-confidence matches)
  if (matches.length === 0) {
    for (const text of texts) {
      for (const [profileKey] of profileMap) {
        const sim = similarity(text, profileKey);
        if (sim >= 0.6) {
          addMatch(profileKey, sim * 0.64, 'fuzzy');
        }
      }
    }
  }

  // Sort by confidence descending
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches;
}

/** Match all detected fields to profile data */
export function matchFields(
  fields: DetectedField[],
  profileFields: ProfileField[],
): MatchedField[] {
  const profileMap = buildProfileMap(profileFields);
  const results: MatchedField[] = [];

  for (const field of fields) {
    const matches = matchField(field, profileMap);
    if (matches.length > 0) {
      results.push({ field, matches });
    }
  }

  return results;
}
