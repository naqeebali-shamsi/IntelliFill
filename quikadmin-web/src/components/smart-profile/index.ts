/**
 * Smart Profile Components
 *
 * Components for the Smart Profile UX flow - simplified document-to-form workflow.
 */

export { SmartUploadZone, type SmartUploadZoneProps } from './SmartUploadZone';
export {
  FileCard,
  type FileCardProps,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_OPTIONS,
} from './FileCard';
export {
  ConfidenceBadge,
  type ConfidenceBadgeProps,
  type ConfidenceLevel,
  getConfidenceDisplay,
  CONFIDENCE_THRESHOLDS,
} from './ConfidenceBadge';
export { FieldSourcePill, type FieldSourcePillProps } from './FieldSourcePill';
export {
  FieldSourceBadge,
  type FieldSourceBadgeProps,
  type FieldSourceBadgeSource,
} from './FieldSourceBadge';
export { MissingFieldsAlert, type MissingFieldsAlertProps } from './MissingFieldsAlert';
export { ProfileView, type ProfileViewProps } from './ProfileView';
export {
  EditableField,
  type EditableFieldProps,
  type FieldType,
  detectFieldType,
} from './EditableField';
export {
  PersonGrouper,
  type PersonGrouperProps,
  type SuggestedMerge,
  type PersonGroup,
  type DocumentItemDocument,
} from './PersonGrouper';
export {
  ConfidenceReview,
  ReviewField,
  FieldConflict,
  type ConfidenceReviewProps,
  type LowConfidenceFieldData,
  type ConflictData,
} from './ConfidenceReview';
export {
  FormSuggester,
  FormCard,
  type FormSuggesterProps,
  type FormCardProps,
} from './FormSuggester';
export { ModeToggle, type ModeToggleProps } from './ModeToggle';
