# PII Sanitizer Utility

Comprehensive PII (Personally Identifiable Information) sanitization utility for IntelliFill. Provides field-name based and value-based pattern detection to redact sensitive information before logging.

## Features

- **Field-name based detection**: Automatically detects and handles PII based on field names
- **Value-based pattern detection**: Detects PII patterns in values (email, phone, Emirates ID, credit cards, etc.)
- **Recursive sanitization**: Handles nested objects and arrays of any depth
- **Circular reference protection**: Prevents infinite loops with circular references
- **Configurable**: Supports custom fields and depth limits
- **Type-safe**: Full TypeScript support with comprehensive types

## Installation

```typescript
import { sanitizeForLogging, PIISanitizer, mayContainPII } from '@/utils/piiSanitizer';
```

## Quick Start

### Basic Usage

```typescript
import { sanitizeForLogging } from '@/utils/piiSanitizer';

const userData = {
  id: 'user-123',
  email: 'john@example.com',
  password: 'secret123',
  name: 'John Doe',
  phone: '+971501234567',
  status: 'active'
};

const sanitized = sanitizeForLogging(userData);

console.log(sanitized);
// Output:
// {
//   id: 'user-123',
//   email: '[REDACTED]',
//   // password is completely removed
//   name: '[REDACTED]',
//   phone: '[REDACTED]',
//   status: 'active'
// }
```

### Using the PIISanitizer Class

```typescript
import { PIISanitizer } from '@/utils/piiSanitizer';

// Create a sanitizer with custom configuration
const sanitizer = new PIISanitizer({
  maxDepth: 5,
  customNeverLog: ['internalToken', 'secretKey'],
  customRedact: ['customPII']
});

// Sanitize data
const sanitized = sanitizer.sanitize(sensitiveData);

// Add more custom fields later
sanitizer.addNeverLogFields('newSecretField');
sanitizer.addRedactFields('newPIIField');
```

## Field Categories

### NEVER_LOG Fields

These fields are **completely removed** from the sanitized output, even in redacted form:

- `password`, `token`, `secret`, `key`, `apiKey`
- `authorization`, `cookie`, `embedding`
- `creditCard`, `cvv`, `ssn`
- `accessToken`, `refreshToken`, `sessionToken`, `bearerToken`
- `privateKey`, `secretKey`, `encryptionKey`

```typescript
const input = {
  userId: '123',
  password: 'secret123',
  token: 'bearer-xyz'
};

const result = sanitizeForLogging(input);
// { userId: '123' }
// password and token are completely removed
```

### REDACT Fields

These fields are **redacted** (field name preserved, value replaced with `[REDACTED]`):

- `email`, `phone`, `name`, `firstName`, `lastName`, `fullName`
- `passportNumber`, `emiratesId`, `address`, `dateOfBirth`, `dob`
- `salary`, `bankAccount`, `iban`, `accountNumber`
- `phoneNumber`, `mobileNumber`, `emailAddress`
- `streetAddress`, `homeAddress`, `workAddress`

```typescript
const input = {
  userId: '123',
  email: 'user@example.com',
  name: 'John Doe'
};

const result = sanitizeForLogging(input);
// { userId: '123', email: '[REDACTED]', name: '[REDACTED]' }
```

## Value-Based Pattern Detection

The sanitizer automatically detects PII patterns in string values:

### Email Addresses

```typescript
const result = sanitizeForLogging({ contact: 'user@example.com' });
// { contact: '[EMAIL_REDACTED]' }
```

### Phone Numbers

Detects 10-15 digit numbers with optional `+` prefix:

```typescript
const result = sanitizeForLogging({
  mobile: '+971501234567',
  phone: '1234567890'
});
// { mobile: '[PHONE_REDACTED]', phone: '[PHONE_REDACTED]' }
```

### Emirates ID

Format: `784-XXXX-XXXXXXX-X`

```typescript
const result = sanitizeForLogging({ id: '784-1234-1234567-1' });
// { id: '[EMIRATES_ID_REDACTED]' }
```

### Credit Cards

13-19 digits, optionally grouped:

```typescript
const result = sanitizeForLogging({ card: '4532-1234-5678-9012' });
// { card: '[CREDIT_CARD_REDACTED]' }
```

### SSN

Format: `XXX-XX-XXXX`

```typescript
const result = sanitizeForLogging({ ssn: '123-45-6789' });
// { ssn: '[SSN_REDACTED]' }
```

### IBAN

2 letters, 2 digits, up to 30 alphanumeric:

```typescript
const result = sanitizeForLogging({ account: 'AE070331234567890123456' });
// { account: '[IBAN_REDACTED]' }
```

### UUID

UUIDs are truncated to first 8 characters for debugging:

```typescript
const result = sanitizeForLogging({
  userId: '550e8400-e29b-41d4-a716-446655440000'
});
// { userId: '550e8400...' }
```

## Advanced Features

### Nested Objects

Recursively sanitizes nested structures:

```typescript
const input = {
  user: {
    id: '123',
    email: 'user@example.com',
    password: 'secret',
    profile: {
      name: 'John Doe',
      phone: '+971501234567'
    }
  }
};

const result = sanitizeForLogging(input);
// {
//   user: {
//     id: '123',
//     email: '[REDACTED]',
//     // password removed
//     profile: {
//       name: '[REDACTED]',
//       phone: '[REDACTED]'
//     }
//   }
// }
```

### Arrays

Sanitizes arrays of primitives and objects:

```typescript
const input = {
  users: [
    { email: 'user1@example.com', password: 'pass1' },
    { email: 'user2@example.com', password: 'pass2' }
  ],
  emails: ['test@example.com', 'admin@example.com']
};

const result = sanitizeForLogging(input);
// {
//   users: [
//     { email: '[REDACTED]' }, // password removed
//     { email: '[REDACTED]' }
//   ],
//   emails: ['[EMAIL_REDACTED]', '[EMAIL_REDACTED]']
// }
```

### Circular References

Automatically detects and handles circular references:

```typescript
const input: any = {
  id: '123',
  email: 'user@example.com'
};
input.self = input; // Create circular reference

const result = sanitizeForLogging(input);
// {
//   id: '123',
//   email: '[REDACTED]',
//   self: '[CIRCULAR_REFERENCE]'
// }
```

### Max Depth Protection

Protects against deeply nested structures:

```typescript
const deeplyNested = {
  l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: { l10: { l11: 'deep' } } } } } } } } } }
};

const result = sanitizeForLogging(deeplyNested, { maxDepth: 10 });
// Stops at depth 10, returns '[MAX_DEPTH_EXCEEDED]' for l11
```

## Configuration Options

### SanitizeOptions

```typescript
interface SanitizeOptions {
  /** Maximum depth for recursive sanitization (default: 10) */
  maxDepth?: number;

  /** Whether to detect and handle circular references (default: true) */
  detectCircular?: boolean;

  /** Custom fields to never log */
  customNeverLog?: string[];

  /** Custom fields to redact */
  customRedact?: string[];
}
```

### Custom Fields

```typescript
const result = sanitizeForLogging(data, {
  customNeverLog: ['internalToken', 'secretKey'],
  customRedact: ['customPII', 'sensitiveField']
});
```

### Custom Max Depth

```typescript
const result = sanitizeForLogging(data, { maxDepth: 5 });
```

### Disable Circular Detection

```typescript
// Not recommended, but available for performance-critical scenarios
const result = sanitizeForLogging(data, {
  detectCircular: false,
  maxDepth: 5 // Still need max depth for protection
});
```

## Using the PIISanitizer Class

### Creating an Instance

```typescript
const sanitizer = new PIISanitizer({
  maxDepth: 5,
  customNeverLog: ['mySecret'],
  customRedact: ['myPII']
});
```

### Sanitizing Data

```typescript
const sanitized = sanitizer.sanitize(userData);
```

### Adding Custom Fields

```typescript
// Add fields to never log
sanitizer.addNeverLogFields('field1', 'field2');

// Add fields to redact
sanitizer.addRedactFields('pii1', 'pii2');
```

### Updating Configuration

```typescript
// Change max depth
sanitizer.setMaxDepth(15);

// Enable/disable circular detection
sanitizer.setCircularDetection(false);

// Get current config
const config = sanitizer.getConfig();

// Reset to defaults
sanitizer.reset();
```

### Default Sanitizer Instance

```typescript
import { defaultSanitizer } from '@/utils/piiSanitizer';

const sanitized = defaultSanitizer.sanitize(userData);
```

## Utility Functions

### mayContainPII

Type guard to check if a value might contain PII:

```typescript
import { mayContainPII } from '@/utils/piiSanitizer';

if (mayContainPII(userData)) {
  console.log('Data contains PII, sanitize before logging');
  const safe = sanitizeForLogging(userData);
  logger.info('User data', safe);
} else {
  logger.info('User data', userData);
}
```

Detects:
- Email patterns in strings
- Phone number patterns
- Emirates ID patterns
- Credit card patterns
- SSN patterns
- IBAN patterns
- PII field names in objects
- Nested PII in object values

## Integration with Logging

### With Winston Logger

```typescript
import { logger } from '@/utils/logger';
import { sanitizeForLogging } from '@/utils/piiSanitizer';

function logUserAction(user: any, action: string) {
  logger.info('User action', {
    action,
    user: sanitizeForLogging(user)
  });
}
```

### Create a Safe Logger Wrapper

```typescript
import { logger } from '@/utils/logger';
import { sanitizeForLogging } from '@/utils/piiSanitizer';

export const safeLogger = {
  info: (message: string, data?: any) => {
    logger.info(message, data ? sanitizeForLogging(data) : undefined);
  },

  warn: (message: string, data?: any) => {
    logger.warn(message, data ? sanitizeForLogging(data) : undefined);
  },

  error: (message: string, data?: any) => {
    logger.error(message, data ? sanitizeForLogging(data) : undefined);
  }
};
```

## Edge Cases

### Null and Undefined

- Null values in regular fields are preserved
- Undefined values in regular fields are preserved
- REDACT fields preserve null/undefined (don't replace with `[REDACTED]`)
- NEVER_LOG fields are always removed regardless of value

```typescript
const input = {
  id: '123',
  email: null,        // Redact field
  password: null,     // Never-log field
  status: null        // Regular field
};

const result = sanitizeForLogging(input);
// {
//   id: '123',
//   email: null,      // Preserved
//   // password removed
//   status: null      // Preserved
// }
```

### Special Object Types

```typescript
// Date objects
const result = sanitizeForLogging({ createdAt: new Date() });
// { createdAt: '2024-01-01T12:00:00.000Z' }

// Error objects
const result = sanitizeForLogging({ error: new Error('Test') });
// { error: { name: 'Error', message: 'Test', stack: '...' } }

// RegExp objects
const result = sanitizeForLogging({ pattern: /test/gi });
// { pattern: '/test/gi' }

// Functions
const result = sanitizeForLogging({ handler: () => {} });
// { handler: '[FUNCTION]' }
```

### Encrypted/Binary Data

Fields with these names are marked as encrypted:

```typescript
const input = {
  encryptedData: 'base64...',
  ciphertext: 'encrypted...',
  hash: 'sha256...'
};

const result = sanitizeForLogging(input);
// {
//   encryptedData: '[ENCRYPTED_DATA]',
//   ciphertext: '[ENCRYPTED_DATA]',
//   hash: '[ENCRYPTED_DATA]'
// }
```

## Best Practices

### 1. Always Sanitize Before Logging

```typescript
// ✅ GOOD
logger.info('User data', sanitizeForLogging(userData));

// ❌ BAD
logger.info('User data', userData);
```

### 2. Use Type Guards

```typescript
// ✅ GOOD
if (mayContainPII(data)) {
  logger.info('Data', sanitizeForLogging(data));
} else {
  logger.info('Data', data);
}
```

### 3. Configure Once, Reuse

```typescript
// ✅ GOOD
const sanitizer = new PIISanitizer({ maxDepth: 5 });
const safe1 = sanitizer.sanitize(data1);
const safe2 = sanitizer.sanitize(data2);

// ❌ LESS EFFICIENT
const safe1 = sanitizeForLogging(data1, { maxDepth: 5 });
const safe2 = sanitizeForLogging(data2, { maxDepth: 5 });
```

### 4. Add Project-Specific Fields

```typescript
const sanitizer = new PIISanitizer({
  customNeverLog: ['authToken', 'sessionId'],
  customRedact: ['visaNumber', 'licenseNumber']
});
```

### 5. Don't Over-Sanitize

```typescript
// ✅ GOOD - Sanitize user-facing data
logger.info('User login', sanitizeForLogging(user));

// ❌ UNNECESSARY - No PII in config
logger.info('Config loaded', config); // No need to sanitize
```

## Performance Considerations

- **Circular detection**: Uses WeakSet for O(1) lookups
- **Max depth**: Prevents excessive recursion
- **Pattern matching**: Optimized regex patterns
- **Lazy evaluation**: Only sanitizes when necessary

## Testing

Comprehensive test suite with 55 tests covering:

- Field-name based detection
- Value-based pattern detection
- Nested objects and arrays
- Edge cases (null, undefined, circular references, max depth)
- Custom configuration
- PIISanitizer class methods
- mayContainPII utility

Run tests:

```bash
npm test piiSanitizer.test.ts
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import {
  sanitizeForLogging,
  PIISanitizer,
  defaultSanitizer,
  mayContainPII,
  type SanitizeOptions
} from '@/utils/piiSanitizer';
```

## Related Files

- `src/utils/piiSanitizer.ts` - Main implementation
- `src/utils/__tests__/piiSanitizer.test.ts` - Test suite
- `src/utils/piiSafeLogger.ts` - Legacy PII-safe logger (deprecated in favor of piiSanitizer)

## Migration from piiSafeLogger

If you're using the old `piiSafeLogger.ts`:

```typescript
// OLD
import { sanitizeForLogging } from '@/utils/piiSafeLogger';

// NEW - More features, better patterns
import { sanitizeForLogging } from '@/utils/piiSanitizer';
```

The new `piiSanitizer` is a drop-in replacement with enhanced features.

## License

Copyright (c) 2025 IntelliFill. All rights reserved.
