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
export { ProfileView, type ProfileViewProps } from './ProfileView';
export {
  EditableField,
  type EditableFieldProps,
  type FieldType,
  detectFieldType,
} from './EditableField';
