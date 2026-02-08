/** Field type categories for detected form fields */
export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  PHONE = 'phone',
  DATE = 'date',
  ADDRESS = 'address',
  SSN = 'ssn',
  NUMBER = 'number',
  UNKNOWN = 'unknown',
}

/** Metadata for a detected form field */
export interface DetectedField {
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  name: string;
  label: string;
  type: FieldType;
  tagName: string;
  inputType: string;
  value: string;
  isRequired: boolean;
  autocomplete: string;
}
