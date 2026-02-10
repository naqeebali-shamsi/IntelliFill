import type { DetectedField } from './field-detection';

/** How a field was matched to a profile key */
export type MatchMethod = 'autocomplete' | 'type' | 'name' | 'label' | 'fuzzy' | 'llm';

/** A single match between a form field and a profile key */
export interface FieldMatch {
  profileField: string;
  value: string;
  confidence: number;
  matchMethod: MatchMethod;
}

/** A detected field with its profile matches */
export interface MatchedField {
  field: DetectedField;
  matches: FieldMatch[];
}

/** Result of a fill-all operation */
export interface FillResult {
  filled: number;
  skipped: number;
  failed: number;
}

/** Context sent to LLM for field inference */
export interface FieldInferenceRequest {
  fields: FieldContext[];
  profileKeys: string[];
}

export interface FieldContext {
  index: number;
  name: string;
  label: string;
  type: string;
  inputType: string;
  autocomplete: string;
  placeholder: string;
}

export interface FieldInferenceResult {
  index: number;
  profileKey: string;
  confidence: number;
}
