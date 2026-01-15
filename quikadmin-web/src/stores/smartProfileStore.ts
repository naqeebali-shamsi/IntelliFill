/**
 * Smart Profile wizard state management with Zustand
 * Manages the multi-step wizard flow for document upload, extraction, and profile creation
 * @module stores/smartProfileStore
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';

import { applyDevtools } from './utils/index.js';

// =================== TYPE DEFINITIONS ===================

export type WizardStep = 'upload' | 'grouping' | 'review' | 'profile' | 'form-select';

export type DocumentType =
  | 'PASSPORT'
  | 'EMIRATES_ID'
  | 'DRIVERS_LICENSE'
  | 'BANK_STATEMENT'
  | 'OTHER';

export type UploadStatus = 'pending' | 'detecting' | 'detected' | 'error';

export interface UploadedFile {
  /** Unique identifier for the uploaded file */
  id: string;
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** Upload status */
  status: UploadStatus;
  /** Detected document type */
  detectedType: DocumentType | null;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Error message if detection failed */
  error?: string;
  /** Timestamp when file was added */
  addedAt: number;
}

export interface DetectedPerson {
  /** Unique identifier for the detected person */
  id: string;
  /** Detected name (if available) */
  name: string | null;
  /** Document IDs associated with this person */
  documentIds: string[];
}

export interface FieldSource {
  /** Document ID this field came from */
  documentId: string;
  /** Document name for display */
  documentName: string;
  /** Extraction confidence (0-1) */
  confidence: number;
  /** When the field was extracted */
  extractedAt: string;
  /** Whether user manually edited this field */
  manuallyEdited?: boolean;
}

export interface LowConfidenceField {
  /** Field name/key */
  fieldName: string;
  /** Extracted value */
  value: unknown;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source document ID */
  documentId: string;
  /** Source document name */
  documentName: string;
}

export interface FieldConflict {
  /** Field name/key */
  fieldName: string;
  /** Array of conflicting values from different documents */
  values: Array<{
    value: unknown;
    source: {
      documentId: string;
      documentName: string;
      confidence: number;
    };
  }>;
  /** Index of currently selected value (-1 for custom) */
  selectedIndex: number;
  /** Custom value if selectedIndex is -1 */
  customValue?: string;
}

export type ExtractionStatus = 'idle' | 'extracting' | 'merging' | 'complete' | 'error';

export interface ExtractionProgress {
  /** Current extraction status */
  status: ExtractionStatus;
  /** Name of the file currently being processed */
  currentFile: string | null;
  /** Number of documents processed so far */
  processedCount: number;
  /** Total number of documents to process */
  totalCount: number;
  /** Error message if extraction failed */
  errorMessage: string | null;
}

// =================== STORE INTERFACES ===================

interface SmartProfileState {
  /** Current wizard step */
  step: WizardStep;
  /** Files in the upload queue (metadata only - File objects stored separately) */
  uploadedFiles: UploadedFile[];
  /** Detected people from documents */
  detectedPeople: DetectedPerson[];
  /** Fields requiring manual review due to low confidence */
  lowConfidenceFields: LowConfidenceField[];
  /** Field conflicts from multiple documents with different values */
  conflicts: FieldConflict[];
  /** Merged profile data from all documents */
  profileData: Record<string, unknown>;
  /** Source tracking for each profile field */
  fieldSources: Record<string, FieldSource>;
  /** Selected form template ID */
  selectedFormId: string | null;
  /** Linked client ID (for existing clients) */
  clientId: string | null;
  /** Processing timestamp */
  processingStartedAt: number | null;
  /** Extraction progress for UI feedback */
  extractionProgress: ExtractionProgress;
}

interface SmartProfileActions {
  /** Set current wizard step */
  setStep: (step: WizardStep) => void;
  /** Add files to upload queue (metadata only) */
  addFiles: (
    files: Array<{ id: string; fileName: string; fileSize: number; mimeType: string }>
  ) => void;
  /** Update file detection results */
  updateFileDetection: (id: string, detectedType: DocumentType, confidence: number) => void;
  /** Set file detection error */
  setFileError: (id: string, error: string) => void;
  /** Set file status */
  setFileStatus: (id: string, status: UploadStatus) => void;
  /** Remove a file from the queue */
  removeFile: (id: string) => void;
  /** Set detected people from grouping analysis */
  setDetectedPeople: (people: DetectedPerson[]) => void;
  /** Set low confidence fields for review */
  setLowConfidenceFields: (fields: LowConfidenceField[]) => void;
  /** Set field conflicts for resolution */
  setConflicts: (conflicts: FieldConflict[]) => void;
  /** Resolve a conflict by selecting an index or custom value */
  resolveConflict: (fieldName: string, selectedIndex: number, customValue?: string) => void;
  /** Set merged profile data */
  setProfileData: (data: Record<string, unknown>) => void;
  /** Update a single profile field */
  updateProfileField: (fieldName: string, value: unknown) => void;
  /** Set field sources */
  setFieldSources: (sources: Record<string, FieldSource>) => void;
  /** Mark a field as manually edited */
  markFieldAsEdited: (fieldName: string) => void;
  /** Select a form template */
  selectForm: (formId: string | null) => void;
  /** Set linked client ID */
  setClientId: (clientId: string | null) => void;
  /** Set processing start time */
  setProcessingStartedAt: (timestamp: number | null) => void;
  /** Update extraction progress for UI feedback */
  setExtractionProgress: (progress: Partial<ExtractionProgress>) => void;
  /** Reset extraction progress to idle */
  resetExtractionProgress: () => void;
  /** Reset wizard to initial state */
  reset: () => void;
  /** Check if can proceed to next step */
  canProceed: () => boolean;
  /** Get next step based on current state */
  getNextStep: () => WizardStep | null;
  /** Get previous step */
  getPreviousStep: () => WizardStep | null;
}

type SmartProfileStore = SmartProfileState & SmartProfileActions;

// =================== INITIAL STATE ===================

const initialExtractionProgress: ExtractionProgress = {
  status: 'idle',
  currentFile: null,
  processedCount: 0,
  totalCount: 0,
  errorMessage: null,
};

const initialState: SmartProfileState = {
  step: 'upload',
  uploadedFiles: [],
  detectedPeople: [],
  lowConfidenceFields: [],
  conflicts: [],
  profileData: {},
  fieldSources: {},
  selectedFormId: null,
  clientId: null,
  processingStartedAt: null,
  extractionProgress: initialExtractionProgress,
};

// =================== STEP NAVIGATION HELPERS ===================

const stepOrder: WizardStep[] = ['upload', 'grouping', 'review', 'profile', 'form-select'];

function getStepIndex(step: WizardStep): number {
  return stepOrder.indexOf(step);
}

// =================== STORE IMPLEMENTATION ===================

export const useSmartProfileStore = create<SmartProfileStore>()(
  applyDevtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // =================== STEP NAVIGATION ===================

        setStep: (step: WizardStep) => {
          set((state) => {
            state.step = step;
          });
        },

        canProceed: (): boolean => {
          const state = get();
          switch (state.step) {
            case 'upload':
              // Need at least one successfully detected file
              return state.uploadedFiles.some((f) => f.status === 'detected');
            case 'grouping':
              // Can always proceed from grouping (optional step)
              return true;
            case 'review':
              // Can proceed after reviewing low confidence fields
              return true;
            case 'profile':
              // Need profile data to proceed
              return Object.keys(state.profileData).length > 0;
            case 'form-select':
              // End of wizard
              return false;
            default:
              return false;
          }
        },

        getNextStep: (): WizardStep | null => {
          const state = get();
          const currentIndex = getStepIndex(state.step);

          // Helper to check if review step is needed
          const needsReview = state.lowConfidenceFields.length > 0 || state.conflicts.length > 0;

          // Auto-skip logic
          if (state.step === 'upload') {
            // Skip grouping if only one person detected or no grouping needed
            if (state.detectedPeople.length <= 1) {
              // Skip review if no low confidence fields and no conflicts
              if (!needsReview) {
                return 'profile';
              }
              return 'review';
            }
            return 'grouping';
          }

          if (state.step === 'grouping') {
            // Skip review if no low confidence fields and no conflicts
            if (!needsReview) {
              return 'profile';
            }
            return 'review';
          }

          if (currentIndex < stepOrder.length - 1) {
            return stepOrder[currentIndex + 1];
          }

          return null;
        },

        getPreviousStep: (): WizardStep | null => {
          const state = get();
          const currentIndex = getStepIndex(state.step);

          if (currentIndex > 0) {
            return stepOrder[currentIndex - 1];
          }

          return null;
        },

        // =================== FILE MANAGEMENT ===================

        addFiles: (files) => {
          set((state) => {
            const newFiles: UploadedFile[] = files.map((f) => ({
              id: f.id,
              fileName: f.fileName,
              fileSize: f.fileSize,
              mimeType: f.mimeType,
              status: 'pending' as const,
              detectedType: null as DocumentType | null,
              confidence: 0,
              addedAt: Date.now(),
            }));
            state.uploadedFiles.push(...newFiles);
          });
        },

        updateFileDetection: (id, detectedType, confidence) => {
          set((state) => {
            const file = state.uploadedFiles.find((f) => f.id === id);
            if (file) {
              file.detectedType = detectedType;
              file.confidence = confidence;
              file.status = 'detected';
              file.error = undefined;
            }
          });
        },

        setFileError: (id, error) => {
          set((state) => {
            const file = state.uploadedFiles.find((f) => f.id === id);
            if (file) {
              file.status = 'error';
              file.error = error;
            }
          });
        },

        setFileStatus: (id, status) => {
          set((state) => {
            const file = state.uploadedFiles.find((f) => f.id === id);
            if (file) {
              file.status = status;
            }
          });
        },

        removeFile: (id) => {
          set((state) => {
            state.uploadedFiles = state.uploadedFiles.filter((f) => f.id !== id);
          });
        },

        // =================== PERSON GROUPING ===================

        setDetectedPeople: (people) => {
          set((state) => {
            state.detectedPeople = people;
          });
        },

        // =================== CONFIDENCE REVIEW ===================

        setLowConfidenceFields: (fields) => {
          set((state) => {
            state.lowConfidenceFields = fields;
          });
        },

        setConflicts: (conflicts) => {
          set((state) => {
            state.conflicts = conflicts;
          });
        },

        resolveConflict: (fieldName, selectedIndex, customValue) => {
          set((state) => {
            const conflict = state.conflicts.find((c) => c.fieldName === fieldName);
            if (conflict) {
              conflict.selectedIndex = selectedIndex;
              conflict.customValue = customValue;
            }
          });
        },

        // =================== PROFILE DATA ===================

        setProfileData: (data) => {
          set((state) => {
            state.profileData = data;
          });
        },

        updateProfileField: (fieldName, value) => {
          set((state) => {
            state.profileData[fieldName] = value;
          });
        },

        setFieldSources: (sources) => {
          set((state) => {
            state.fieldSources = sources;
          });
        },

        markFieldAsEdited: (fieldName) => {
          set((state) => {
            if (state.fieldSources[fieldName]) {
              state.fieldSources[fieldName].manuallyEdited = true;
            } else {
              // Create a new source entry for manually added fields
              state.fieldSources[fieldName] = {
                documentId: 'manual',
                documentName: 'Manual Entry',
                confidence: 1,
                extractedAt: new Date().toISOString(),
                manuallyEdited: true,
              };
            }
          });
        },

        // =================== FORM SELECTION ===================

        selectForm: (formId) => {
          set((state) => {
            state.selectedFormId = formId;
          });
        },

        // =================== CLIENT LINKING ===================

        setClientId: (clientId) => {
          set((state) => {
            state.clientId = clientId;
          });
        },

        // =================== PROCESSING ===================

        setProcessingStartedAt: (timestamp) => {
          set((state) => {
            state.processingStartedAt = timestamp;
          });
        },

        // =================== EXTRACTION PROGRESS ===================

        setExtractionProgress: (progress) => {
          set((state) => {
            state.extractionProgress = {
              ...state.extractionProgress,
              ...progress,
            };
          });
        },

        resetExtractionProgress: () => {
          set((state) => {
            state.extractionProgress = initialExtractionProgress;
          });
        },

        // =================== RESET ===================

        reset: () => {
          set(initialState);
        },
      })),
      {
        name: 'smart-profile-wizard',
        storage: createJSONStorage(() => localStorage),
        // Only persist serializable data, not File objects
        partialize: (state) => ({
          step: state.step,
          uploadedFiles: state.uploadedFiles,
          detectedPeople: state.detectedPeople,
          lowConfidenceFields: state.lowConfidenceFields,
          conflicts: state.conflicts,
          profileData: state.profileData,
          fieldSources: state.fieldSources,
          selectedFormId: state.selectedFormId,
          clientId: state.clientId,
          processingStartedAt: state.processingStartedAt,
        }),
      }
    ),
    'IntelliFill Smart Profile Store'
  )
);

// =================== SELECTORS ===================

export const smartProfileSelectors = {
  step: (state: SmartProfileStore) => state.step,
  uploadedFiles: (state: SmartProfileStore) => state.uploadedFiles,
  detectedFiles: (state: SmartProfileStore) =>
    state.uploadedFiles.filter((f) => f.status === 'detected'),
  pendingFiles: (state: SmartProfileStore) =>
    state.uploadedFiles.filter((f) => f.status === 'pending' || f.status === 'detecting'),
  errorFiles: (state: SmartProfileStore) => state.uploadedFiles.filter((f) => f.status === 'error'),
  detectedPeople: (state: SmartProfileStore) => state.detectedPeople,
  lowConfidenceFields: (state: SmartProfileStore) => state.lowConfidenceFields,
  conflicts: (state: SmartProfileStore) => state.conflicts,
  profileData: (state: SmartProfileStore) => state.profileData,
  fieldSources: (state: SmartProfileStore) => state.fieldSources,
  selectedFormId: (state: SmartProfileStore) => state.selectedFormId,
  clientId: (state: SmartProfileStore) => state.clientId,
  hasFiles: (state: SmartProfileStore) => state.uploadedFiles.length > 0,
  fileCount: (state: SmartProfileStore) => state.uploadedFiles.length,
  detectedFileCount: (state: SmartProfileStore) =>
    state.uploadedFiles.filter((f) => f.status === 'detected').length,
  extractionProgress: (state: SmartProfileStore) => state.extractionProgress,
  isExtracting: (state: SmartProfileStore) =>
    state.extractionProgress.status === 'extracting' ||
    state.extractionProgress.status === 'merging',
};

// =================== HOOKS ===================

/**
 * Hook for wizard navigation
 */
export const useWizardNavigation = () =>
  useSmartProfileStore(
    useShallow((state) => ({
      step: state.step,
      setStep: state.setStep,
      canProceed: state.canProceed,
      getNextStep: state.getNextStep,
      getPreviousStep: state.getPreviousStep,
      reset: state.reset,
    }))
  );

/**
 * Hook for file upload management
 */
export const useSmartUpload = () =>
  useSmartProfileStore(
    useShallow((state) => ({
      files: state.uploadedFiles,
      addFiles: state.addFiles,
      removeFile: state.removeFile,
      updateFileDetection: state.updateFileDetection,
      setFileError: state.setFileError,
      setFileStatus: state.setFileStatus,
    }))
  );

/**
 * Hook for profile data management
 */
export const useProfileData = () =>
  useSmartProfileStore(
    useShallow((state) => ({
      profileData: state.profileData,
      fieldSources: state.fieldSources,
      setProfileData: state.setProfileData,
      updateProfileField: state.updateProfileField,
      setFieldSources: state.setFieldSources,
      markFieldAsEdited: state.markFieldAsEdited,
    }))
  );

/**
 * Hook for extraction results
 */
export const useExtractionResults = () =>
  useSmartProfileStore(
    useShallow((state) => ({
      detectedPeople: state.detectedPeople,
      lowConfidenceFields: state.lowConfidenceFields,
      conflicts: state.conflicts,
      setDetectedPeople: state.setDetectedPeople,
      setLowConfidenceFields: state.setLowConfidenceFields,
      setConflicts: state.setConflicts,
      resolveConflict: state.resolveConflict,
    }))
  );

/**
 * Hook for extraction progress tracking
 * Provides progress state and actions for UI feedback during extraction
 */
export const useExtractionProgress = () =>
  useSmartProfileStore(
    useShallow((state) => ({
      progress: state.extractionProgress,
      setProgress: state.setExtractionProgress,
      resetProgress: state.resetExtractionProgress,
      isExtracting:
        state.extractionProgress.status === 'extracting' ||
        state.extractionProgress.status === 'merging',
    }))
  );
