/**
 * SmartProfile page - Streamlined document-to-profile wizard
 * Implements the "Upload → See → Fill" flow for easy document processing
 */

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PageHeader } from '@/components/layout/page-header';
import {
  stepVariants,
  fadeStepVariants,
  stepTransition,
  reducedMotionTransition,
} from '@/components/smart-profile/animations/wizard-variants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useSmartProfileStore,
  useWizardNavigation,
  type WizardStep,
} from '@/stores/smartProfileStore';
import { fileObjectStore } from '@/stores/fileObjectStore';
import { extractBatch } from '@/services/smartProfileService';
import { cn } from '@/lib/utils';
import {
  Upload,
  Users,
  CheckCircle,
  User,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Check,
  Loader2,
  Save,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import {
  SmartUploadZone,
  ProfileView,
  PersonGrouper,
  ConfidenceReview,
  MissingFieldsAlert,
  ModeToggle,
  FormSuggester,
  ClientSelector,
} from '@/components/smart-profile';
import type { SuggestedMerge } from '@/services/smartProfileService';
import type { ConflictData, LowConfidenceFieldData } from '@/components/smart-profile';
import { profilesService } from '@/services/profilesService';
import { clientsService, type ClientType } from '@/services/clientsService';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useClientSelection } from '@/stores/smartProfileStore';
import { getMissingFields, getSuggestedDocuments } from '@/lib/form-fields';
import { useUserPreferencesStore, MODE_CONFIDENCE_THRESHOLDS } from '@/stores/userPreferencesStore';
import { startTiming, wizardTimer } from '@/lib/performance';

// =================== STEP CONFIGURATION ===================

interface StepConfig {
  id: WizardStep;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const steps: StepConfig[] = [
  {
    id: 'upload',
    label: 'Upload',
    description: 'Drop your documents',
    icon: Upload,
  },
  {
    id: 'grouping',
    label: 'Grouping',
    description: 'Organize by person',
    icon: Users,
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Verify extracted data',
    icon: CheckCircle,
  },
  {
    id: 'profile',
    label: 'Profile',
    description: 'View complete profile',
    icon: User,
  },
  {
    id: 'form-select',
    label: 'Forms',
    description: 'Select forms to fill',
    icon: FileText,
  },
];

// =================== STEP INDICATOR ===================

interface StepIndicatorProps {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
}

function StepIndicator({ currentStep, completedSteps }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav aria-label="Wizard progress" className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isPast = index < currentIndex;
        const Icon = step.icon;

        // Determine step status for accessibility
        const stepStatus = isActive ? 'current' : isCompleted ? 'completed' : 'upcoming';

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div
                className={cn(
                  'h-0.5 w-8 transition-colors',
                  isPast || isCompleted ? 'bg-primary' : 'bg-border'
                )}
                aria-hidden="true"
              />
            )}
            <div
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${step.label} - ${stepStatus}`}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all',
                isActive && 'bg-primary text-primary-foreground shadow-md',
                !isActive && isCompleted && 'bg-primary/10 text-primary',
                !isActive && !isCompleted && 'bg-muted text-muted-foreground'
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  isActive && 'bg-primary-foreground/20',
                  isCompleted && !isActive && 'bg-primary/20'
                )}
                aria-hidden="true"
              >
                {isCompleted && !isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span className="hidden font-medium sm:inline">{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// =================== STEP CONTENT COMPONENTS ===================

function UploadStepContent() {
  const detectedFileCount = useSmartProfileStore(
    (state) => state.uploadedFiles.filter((f) => f.status === 'detected').length
  );
  const totalFileCount = useSmartProfileStore((state) => state.uploadedFiles.length);

  // Start wizard timing when first file is detected
  const handleFilesReady = React.useCallback(() => {
    // Only start timer on first upload batch
    wizardTimer.start('Total Wizard Flow');
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>
          Drop your passport, Emirates ID, driver's license, or other documents here. We'll
          automatically detect the document type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SmartUploadZone onFilesReady={handleFilesReady} />
        {totalFileCount > 0 && detectedFileCount === totalFileCount && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Click <strong>Continue</strong> to proceed with {detectedFileCount} document
            {detectedFileCount !== 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface GroupingStepContentProps {
  suggestedMerges: SuggestedMerge[];
}

function GroupingStepContent({ suggestedMerges }: GroupingStepContentProps) {
  const detectedPeople = useSmartProfileStore((state) => state.detectedPeople);
  const uploadedFiles = useSmartProfileStore((state) => state.uploadedFiles);
  const setDetectedPeople = useSmartProfileStore((state) => state.setDetectedPeople);

  // Convert uploadedFiles to documents format for PersonGrouper
  const documents = React.useMemo(() => {
    return uploadedFiles
      .filter((f) => f.status === 'detected')
      .map((f) => ({
        id: f.id,
        fileName: f.fileName,
        detectedType: f.detectedType,
        confidence: f.confidence,
      }));
  }, [uploadedFiles]);

  // Convert detectedPeople to groups format for PersonGrouper
  const groups = React.useMemo(() => {
    return detectedPeople.map((person) => ({
      id: person.id,
      name: person.name,
      confidence: 0.85, // Default confidence for detected groups
      documentIds: person.documentIds,
    }));
  }, [detectedPeople]);

  // Handle grouping changes from PersonGrouper
  const handleGroupingChange = React.useCallback(
    (updatedGroups: Array<{ id: string; name: string | null; documentIds: string[] }>) => {
      // Convert back to DetectedPerson format and update store
      const updatedPeople = updatedGroups.map((group) => ({
        id: group.id,
        name: group.name,
        documentIds: group.documentIds,
      }));
      setDetectedPeople(updatedPeople);
    },
    [setDetectedPeople]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Person Grouping</CardTitle>
        <CardDescription>
          {detectedPeople.length > 1
            ? 'We detected multiple people in your documents. Drag documents between groups to correct any mistakes.'
            : 'Organize documents by person if needed'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length > 0 ? (
          <PersonGrouper
            groups={groups}
            documents={documents}
            suggestedMerges={suggestedMerges}
            onGroupingChange={handleGroupingChange}
          />
        ) : (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">No people detected yet</p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Upload and extract documents first
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ReviewStepContentProps {
  onComplete: () => void;
}

function ReviewStepContent({ onComplete }: ReviewStepContentProps) {
  const lowConfidenceFields = useSmartProfileStore((state) => state.lowConfidenceFields);
  const conflicts = useSmartProfileStore((state) => state.conflicts);
  const updateProfileField = useSmartProfileStore((state) => state.updateProfileField);
  const markFieldAsEdited = useSmartProfileStore((state) => state.markFieldAsEdited);
  const resolveConflict = useSmartProfileStore((state) => state.resolveConflict);

  // Convert store types to component types
  const lowConfidenceFieldsData: LowConfidenceFieldData[] = lowConfidenceFields.map((f) => ({
    fieldName: f.fieldName,
    value: f.value,
    confidence: f.confidence,
    documentId: f.documentId,
    documentName: f.documentName,
  }));

  const conflictsData: ConflictData[] = conflicts.map((c) => ({
    fieldName: c.fieldName,
    values: c.values,
    selectedIndex: c.selectedIndex,
    customValue: c.customValue,
  }));

  // Handle field value update
  const handleFieldUpdate = (fieldName: string, value: unknown) => {
    updateProfileField(fieldName, value);
    markFieldAsEdited(fieldName);
  };

  // Handle conflict resolution
  const handleConflictResolve = (
    fieldName: string,
    selectedIndex: number,
    customValue?: string
  ) => {
    resolveConflict(fieldName, selectedIndex, customValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Extracted Data</CardTitle>
        <CardDescription>
          Verify fields that need attention due to low confidence or conflicts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ConfidenceReview
          lowConfidenceFields={lowConfidenceFieldsData}
          conflicts={conflictsData}
          onFieldUpdate={handleFieldUpdate}
          onConflictResolve={handleConflictResolve}
          onComplete={onComplete}
        />
      </CardContent>
    </Card>
  );
}

interface ProfileStepContentProps {
  onSaveToClient: (clientId: string) => Promise<void>;
  onCreateClientAndSave: (name: string, type: ClientType) => Promise<void>;
  isSaving: boolean;
}

function ProfileStepContent({
  onSaveToClient,
  onCreateClientAndSave,
  isSaving,
}: ProfileStepContentProps) {
  const profileData = useSmartProfileStore((state) => state.profileData);
  const fieldSources = useSmartProfileStore((state) => state.fieldSources);
  const updateProfileField = useSmartProfileStore((state) => state.updateProfileField);
  const markFieldAsEdited = useSmartProfileStore((state) => state.markFieldAsEdited);
  const selectedFormId = useSmartProfileStore((state) => state.selectedFormId);

  // Client selection state
  const { savedClientName, clearClientSelection } = useClientSelection();

  // Track whether user has dismissed the missing fields alert
  const [alertDismissed, setAlertDismissed] = React.useState(false);

  // Track whether client selector is open
  const [clientSelectorOpen, setClientSelectorOpen] = React.useState(false);

  // Calculate missing fields for selected form (or default to visa-application)
  const formType = selectedFormId || 'visa-application';
  const missingFields = React.useMemo(
    () => getMissingFields(profileData as Record<string, unknown>, formType),
    [profileData, formType]
  );
  const suggestedDocuments = React.useMemo(
    () => getSuggestedDocuments(missingFields),
    [missingFields]
  );

  // Get default name from profile data for new client creation
  const defaultClientName = React.useMemo(() => {
    const firstName = (profileData.firstName as string) || '';
    const lastName = (profileData.lastName as string) || '';
    const fullName = (profileData.fullName as string) || `${firstName} ${lastName}`.trim();
    return fullName || '';
  }, [profileData]);

  const handleFieldChange = (fieldName: string, newValue: unknown) => {
    updateProfileField(fieldName, newValue);
  };

  const handleFieldEdited = (fieldName: string) => {
    markFieldAsEdited(fieldName);
  };

  const handleDismissAlert = () => {
    setAlertDismissed(true);
  };

  const handleSelectExisting = async (clientId: string, clientName: string) => {
    await onSaveToClient(clientId);
    setClientSelectorOpen(false);
  };

  const handleCreateNew = async (name: string, type: ClientType) => {
    await onCreateClientAndSave(name, type);
    setClientSelectorOpen(false);
  };

  const handleCancelClientSelect = () => {
    setClientSelectorOpen(false);
  };

  const handleChangeClient = () => {
    clearClientSelection();
    setClientSelectorOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Missing fields alert - shown before ProfileView */}
      {!alertDismissed && missingFields.length > 0 && (
        <MissingFieldsAlert
          missingFields={missingFields}
          suggestedDocuments={suggestedDocuments}
          onDismiss={handleDismissAlert}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>
                Review and edit your extracted profile data. Click any field to edit.
              </CardDescription>
            </div>
            {/* Save to Client section */}
            <div className="flex items-center gap-2">
              {savedClientName ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success-muted" className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Saved to: {savedClientName}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleChangeClient}>
                    Change
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setClientSelectorOpen(!clientSelectorOpen)}
                  disabled={isSaving}
                  variant={clientSelectorOpen ? 'secondary' : 'default'}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Save to Client
                      <ChevronDown
                        className={cn(
                          'ml-2 h-4 w-4 transition-transform',
                          clientSelectorOpen && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Client Selector - Collapsible section */}
        <Collapsible open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
          <CollapsibleContent>
            <div className="border-t px-6 py-4 bg-muted/30">
              <ClientSelector
                onSelectExisting={handleSelectExisting}
                onCreateNew={handleCreateNew}
                onCancel={handleCancelClientSelect}
                defaultName={defaultClientName}
                isLoading={isSaving}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <CardContent>
          <ProfileView
            profileData={profileData as Record<string, unknown>}
            fieldSources={fieldSources}
            onFieldChange={handleFieldChange}
            onFieldEdited={handleFieldEdited}
            editable
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FormSelectStepContent() {
  const selectedFormId = useSmartProfileStore((state) => state.selectedFormId);
  const selectForm = useSmartProfileStore((state) => state.selectForm);
  const uploadedFiles = useSmartProfileStore((state) => state.uploadedFiles);

  // Convert detected file types to document type names for FormSuggester
  // Map internal types (PASSPORT, EMIRATES_ID) to display names (Passport, Emirates ID)
  const documentTypes = React.useMemo(() => {
    const typeMap: Record<string, string> = {
      PASSPORT: 'Passport',
      EMIRATES_ID: 'Emirates ID',
      DRIVERS_LICENSE: "Driver's License",
      BANK_STATEMENT: 'Bank Statement',
      OTHER: 'Other',
    };

    return uploadedFiles
      .filter((f) => f.status === 'detected' && f.detectedType)
      .map((f) => typeMap[f.detectedType!] || 'Other')
      .filter((type, index, arr) => arr.indexOf(type) === index); // dedupe
  }, [uploadedFiles]);

  const handleSelectForm = (formId: string) => {
    selectForm(formId);
    // End total wizard timing when form is selected
    wizardTimer.end('Total Wizard Flow');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select a Form</CardTitle>
        <CardDescription>
          Based on your uploaded documents, we suggest forms you can fill. Select one to proceed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormSuggester
          documentTypes={documentTypes}
          selectedFormId={selectedFormId}
          onSelectForm={handleSelectForm}
        />
      </CardContent>
    </Card>
  );
}

// =================== MAIN COMPONENT ===================

export default function SmartProfile() {
  const { step, setStep, canProceed, getNextStep, getPreviousStep, reset } = useWizardNavigation();
  const [completedSteps, setCompletedSteps] = React.useState<Set<WizardStep>>(new Set());
  const [isExtracting, setIsExtracting] = React.useState(false);
  const [extractionError, setExtractionError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [suggestedMerges, setSuggestedMerges] = React.useState<SuggestedMerge[]>([]);

  // Animation: track direction (1 = forward, -1 = backward)
  const [direction, setDirection] = React.useState(1);
  const shouldReduceMotion = useReducedMotion();

  // User preferences for wizard behavior (assisted vs express mode)
  const wizardMode = useUserPreferencesStore((s) => s.wizardMode);
  const confidenceThreshold = MODE_CONFIDENCE_THRESHOLDS[wizardMode];

  // Get store actions for updating extraction results
  const setProfileData = useSmartProfileStore((state) => state.setProfileData);
  const setFieldSources = useSmartProfileStore((state) => state.setFieldSources);
  const setLowConfidenceFields = useSmartProfileStore((state) => state.setLowConfidenceFields);
  const setConflicts = useSmartProfileStore((state) => state.setConflicts);
  const setDetectedPeople = useSmartProfileStore((state) => state.setDetectedPeople);
  const uploadedFiles = useSmartProfileStore((state) => state.uploadedFiles);
  const profileData = useSmartProfileStore((state) => state.profileData);
  const clientId = useSmartProfileStore((state) => state.clientId);
  const setClientId = useSmartProfileStore((state) => state.setClientId);

  // Mark steps as completed when moving forward
  const handleNext = async () => {
    const nextStep = getNextStep();
    if (!nextStep || !canProceed()) return;

    // If moving from upload step, trigger extraction first
    if (step === 'upload') {
      setIsExtracting(true);
      setExtractionError(null);

      // Start extraction timing
      const endExtractionTiming = startTiming('Batch Extraction');

      try {
        // Get detected files and their types
        const detectedFiles = uploadedFiles.filter((f) => f.status === 'detected');
        const fileIds = detectedFiles.map((f) => f.id);
        const files = fileObjectStore.getByIds(fileIds);
        const documentTypes = detectedFiles.map((f) => f.detectedType || 'OTHER');

        // Call extraction API
        const result = await extractBatch(files, documentTypes);

        // End extraction timing
        endExtractionTiming();

        if (result.success) {
          // Store extraction results
          setProfileData(result.profileData);
          setFieldSources(result.fieldSources);
          setLowConfidenceFields(result.lowConfidenceFields);

          // Store conflicts if present (from API or default to empty)
          const extractedConflicts = result.conflicts || [];
          setConflicts(extractedConflicts);

          // Store detected people and merge suggestions if present
          if (result.detectedPeople && result.detectedPeople.length > 0) {
            setDetectedPeople(result.detectedPeople);
          }
          if (result.suggestedMerges) {
            setSuggestedMerges(result.suggestedMerges);
          }

          // Determine next step based on extraction results
          let targetStep: WizardStep = nextStep;

          // Check if we should show the grouping step (more than 1 person detected)
          const hasMultiplePeople = result.detectedPeople && result.detectedPeople.length > 1;

          // Calculate minimum confidence from field sources for auto-skip decision
          // Mode-dependent threshold: Express = 90%, Assisted = 85%
          const fieldConfidences = Object.values(result.fieldSources || {}).map(
            (source) => source.confidence
          );
          const minConfidence = fieldConfidences.length > 0 ? Math.min(...fieldConfidences) : 0;

          // Determine if review is needed based on mode-specific threshold
          // Review needed if: has low confidence fields, has conflicts, OR min confidence below threshold
          const shouldSkipReview =
            result.lowConfidenceFields.length === 0 &&
            extractedConflicts.length === 0 &&
            minConfidence >= confidenceThreshold;

          if (hasMultiplePeople) {
            // Multiple people detected - go to grouping step
            targetStep = 'grouping';
          } else if (shouldSkipReview) {
            // Single person, all fields high confidence - skip to profile
            targetStep = 'profile';
          } else {
            // Single person, needs review due to low confidence or conflicts
            targetStep = 'review';
          }

          setCompletedSteps((prev) => new Set([...prev, step]));
          setDirection(1); // Forward navigation
          setStep(targetStep);
        } else {
          const message = 'Extraction failed. Please try again.';
          setExtractionError(message);
          toast.error(message);
        }
      } catch (error) {
        console.error('Extraction error:', error);
        const fallbackMessage = 'Extraction failed. Please try again.';
        const errorMessage =
          axios.isAxiosError(error) && error.response?.data?.message
            ? String(error.response.data.message)
            : error instanceof Error
              ? error.message
              : fallbackMessage;
        setExtractionError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsExtracting(false);
      }
      return;
    }

    // For other steps, just navigate
    setCompletedSteps((prev) => new Set([...prev, step]));
    setDirection(1); // Forward navigation
    setStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = getPreviousStep();
    if (prevStep) {
      setDirection(-1); // Backward navigation
      setStep(prevStep);
    }
  };

  const handleReset = () => {
    reset();
    clearClientSelection();
    setCompletedSteps(new Set());
    setExtractionError(null);
    setSuggestedMerges([]);
    fileObjectStore.clear();
    wizardTimer.clear();
  };

  // Get client selection actions from store
  const selectExistingClient = useSmartProfileStore((state) => state.selectExistingClient);
  const setSavedClientName = useSmartProfileStore((state) => state.setSavedClientName);
  const clearClientSelection = useSmartProfileStore((state) => state.clearClientSelection);

  // Save profile to existing client
  const handleSaveToClient = async (targetClientId: string) => {
    setIsSaving(true);
    try {
      // Get client details for the name
      const clientResponse = await clientsService.getClientById(targetClientId);
      const clientName = clientResponse.data.client.name;

      // Use the profilesService to update the client profile with extracted data
      // The backend PUT /api/clients/:clientId/profile endpoint handles merging
      await profilesService.updateProfileData(targetClientId, profileData);

      // Update store with successful save
      selectExistingClient(targetClientId, clientName);
      setClientId(targetClientId);
      toast.success(`Profile saved to ${clientName}`);
    } catch (error) {
      console.error('Save to client error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save profile to client');
    } finally {
      setIsSaving(false);
    }
  };

  // Create new client and save profile
  const handleCreateClientAndSave = async (name: string, type: ClientType) => {
    setIsSaving(true);
    try {
      // Create the new client
      const clientResponse = await clientsService.createClient({ name, type });
      const newClient = clientResponse.data.client;

      // Save profile data to the new client using profilesService
      await profilesService.updateProfileData(newClient.id, profileData);

      // Update store with successful save
      selectExistingClient(newClient.id, newClient.name);
      setSavedClientName(newClient.name);
      setClientId(newClient.id);
      toast.success(`Client "${name}" created and profile saved`);
    } catch (error) {
      console.error('Create client and save error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create client');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle review step completion
  const handleReviewComplete = () => {
    setCompletedSteps((prev) => new Set([...prev, 'review']));
    setStep('profile');
  };

  // Render step content based on current step
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return <UploadStepContent />;
      case 'grouping':
        return <GroupingStepContent suggestedMerges={suggestedMerges} />;
      case 'review':
        return <ReviewStepContent onComplete={handleReviewComplete} />;
      case 'profile':
        return (
          <ProfileStepContent
            onSaveToClient={handleSaveToClient}
            onCreateClientAndSave={handleCreateClientAndSave}
            isSaving={isSaving}
          />
        );
      case 'form-select':
        return <FormSelectStepContent />;
      default:
        return null;
    }
  };

  const currentStepConfig = steps.find((s) => s.id === step);
  const isFirstStep = step === 'upload';
  const isLastStep = step === 'form-select';

  return (
    <div className="space-y-6" data-testid="smart-profile-page">
      {/* Page Header */}
      <PageHeader
        title="Smart Profile"
        description="Upload documents and create client profiles in seconds"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Smart Profile', href: '/smart-profile' },
          { label: currentStepConfig?.label || 'Upload' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        }
      />

      {/* Step Indicator with Mode Toggle */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-2">
          <div className="flex-1" />
          <div className="flex-1">
            <StepIndicator currentStep={step} completedSteps={completedSteps} />
          </div>
          <div className="flex flex-1 justify-end">
            <ModeToggle />
          </div>
        </div>
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={shouldReduceMotion ? fadeStepVariants : stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={shouldReduceMotion ? reducedMotionTransition : stepTransition}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      {/* Extraction Error */}
      {extractionError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-status-error/30 bg-status-error/10 p-3 text-center text-status-error-foreground"
        >
          {extractionError}
        </motion.div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={isFirstStep || isExtracting}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          {isExtracting ? 'Extracting data from documents...' : currentStepConfig?.description}
        </div>

        <Button onClick={handleNext} disabled={isLastStep || !canProceed() || isExtracting}>
          {isExtracting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Extracting...
            </>
          ) : isLastStep ? (
            'Complete'
          ) : (
            <>
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
