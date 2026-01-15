/**
 * Name Similarity Utilities for Entity Resolution
 *
 * Provides name normalization and comparison functions for detecting
 * when documents might belong to the same person despite name variations
 * (transliterations, different orderings, diacritics, etc.)
 *
 * @module lib/entity-resolution/nameSimilarity
 */

/**
 * Common Arabic to English transliteration variants
 * Maps a canonical form to its common alternative spellings
 */
export const TRANSLITERATION_MAP: Record<string, string[]> = {
  mohamed: ['mohammed', 'mohammad', 'muhammed', 'mohamad', 'mehmed', 'mahomad', 'muhamed'],
  ahmed: ['ahmad', 'achmed', 'ahmet'],
  ali: ['aly'],
  omar: ['umar', 'omer'],
  hassan: ['hasan', 'hasen'],
  hussein: ['husain', 'hussain', 'hosein', 'hossein'],
  abdullah: ['abdallah', 'abdulla', 'abdul'],
  abdul: ['abd'],
  fatima: ['fatimah', 'fatma'],
  aisha: ['aysha', 'ayesha', 'aiesha'],
  khalid: ['khaled'],
  yusuf: ['yousuf', 'yousef', 'yosef', 'joseph'],
  ibrahim: ['ebrahim', 'abraham'],
  ismail: ['ismaeel', 'ismael'],
  mustafa: ['mostafa', 'mustapha'],
  noor: ['nur', 'nour'],
  rashid: ['rashed', 'rasheed'],
  said: ['saeed', 'saeid'],
  saleh: ['salih', 'salah'],
  tariq: ['tarek', 'tarik'],
  zainab: ['zaynab', 'zeinab'],
};

/**
 * Normalize a name for comparison
 *
 * - Converts to lowercase
 * - Removes diacritics (accents)
 * - Removes non-alphabetic characters except spaces
 * - Normalizes whitespace
 *
 * @param name - The name to normalize
 * @returns Normalized name string
 *
 * @example
 * normalizeName("Mohamed Al-Ali")  // "mohamed al ali"
 * normalizeName("Jose")           // "jose"
 */
export function normalizeName(name: string): string {
  if (!name) return '';

  return (
    name
      .toLowerCase()
      // Remove diacritics (NFD decomposes, then remove combining marks)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Keep only letters and spaces
      .replace(/[^a-z\s]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Check if two names might be transliteration variants of each other
 *
 * This checks if any word in one name is a known variant of a word in the other.
 * Useful for Arabic/Hindi names that can be spelled multiple ways in English.
 *
 * @param name1 - First name to compare
 * @param name2 - Second name to compare
 * @returns True if names contain transliteration variants
 *
 * @example
 * areTransliterationVariants("Mohamed Ali", "Mohammed Aly")  // true
 * areTransliterationVariants("John Smith", "Jane Doe")       // false
 */
export function areTransliterationVariants(name1: string, name2: string): boolean {
  const parts1 = normalizeName(name1).split(' ');
  const parts2 = normalizeName(name2).split(' ');

  for (const part1 of parts1) {
    for (const part2 of parts2) {
      // Skip if they're identical
      if (part1 === part2) continue;

      // Check if part1 is a variant of part2
      const variants1 = TRANSLITERATION_MAP[part1] || [];
      if (variants1.includes(part2)) {
        return true;
      }

      // Check if part2 is a variant of part1
      const variants2 = TRANSLITERATION_MAP[part2] || [];
      if (variants2.includes(part1)) {
        return true;
      }

      // Check if both are variants of the same canonical form
      for (const [canonical, variants] of Object.entries(TRANSLITERATION_MAP)) {
        const isVariant1 = part1 === canonical || variants.includes(part1);
        const isVariant2 = part2 === canonical || variants.includes(part2);
        if (isVariant1 && isVariant2) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get the canonical form of a name part if it's a known transliteration variant
 *
 * @param namePart - A single name part (word)
 * @returns The canonical form, or the original if not found
 */
export function getCanonicalForm(namePart: string): string {
  const normalized = normalizeName(namePart);

  // Check if it's already a canonical form
  if (TRANSLITERATION_MAP[normalized]) {
    return normalized;
  }

  // Check if it's a variant of a canonical form
  for (const [canonical, variants] of Object.entries(TRANSLITERATION_MAP)) {
    if (variants.includes(normalized)) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Canonicalize an entire name by converting all known variants to their canonical forms
 *
 * @param name - The full name to canonicalize
 * @returns Name with all variants converted to canonical forms
 *
 * @example
 * canonicalizeName("Mohammed Ahmad")  // "mohamed ahmed"
 */
export function canonicalizeName(name: string): string {
  const parts = normalizeName(name).split(' ');
  return parts.map(getCanonicalForm).join(' ');
}
