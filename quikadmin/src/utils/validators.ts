export function validateDatabaseUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
      return { valid: false, error: 'Invalid protocol - must be postgresql://' };
    }

    if (!parsed.hostname) {
      return { valid: false, error: 'Missing hostname' };
    }

    if (!parsed.pathname || parsed.pathname === '/') {
      return { valid: false, error: 'Missing database name' };
    }

    if (parsed.hostname.includes('neon.tech') && !url.includes('sslmode=require')) {
      return { valid: false, error: 'Neon requires SSL - add ?sslmode=require' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}
