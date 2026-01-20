/**
 * Custom error class for file validation failures.
 *
 * This allows the global error handler to identify and return appropriate HTTP status codes.
 * The error handler in index.ts checks `err.name === 'FileValidationError'` to handle these errors.
 *
 * @example
 * throw new FileValidationError('Invalid file type', 'INVALID_FILE_TYPE');
 */
export class FileValidationError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'FileValidationError';
    this.code = code;
  }
}
