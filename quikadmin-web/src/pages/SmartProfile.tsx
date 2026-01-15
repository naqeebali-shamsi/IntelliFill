/**
 * SmartProfile page - Streamlined document-to-profile wizard
 * Implements the "Upload → See → Fill" flow for easy document processing
 */

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  RotateCcw,
  Check,
  Loader2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SmartUploadZone,
  ProfileView,
  PersonGrouper,
  ConfidenceReview,
  MissingFieldsAlert,
} from '@/components/smart-profile';
import type { SuggestedMerge } from '@/services/smartProfileService';
import type { ConflictData, LowConfidenceFieldData } from '@/components/smart-profile';
import { profilesService } from '@/services/profilesService';
import { getMissingFields, getSuggestedDocuments } from '@/lib/form-fields';

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
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isPast = index < currentIndex;
        const Icon = step.icon;

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <div
                className={cn(
                  'h-0.5 w-8 transition-colors',
                  isPast || isCompleted ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
            <div
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
    </div>
  );
}

// =================== STEP CONTENT COMPONENTS ===================

function UploadStepContent() {
  const detectedFileCount = useSmartProfileStore(
    (state) => state.uploadedFiles.filter((f) => f.status === 'detected').length
  );
  const totalFileCount = useSmartProfileStore((state) => state.uploadedFiles.length);

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
        <SmartUploadZone />
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
  onSaveProfile: () => Promise<void>;
  isSaving: boolean;
}

function ProfileStepContent({ onSaveProfile, isSaving }: ProfileStepContentProps) {
  const profileData = useSmartProfileStore((state) => state.profileData);
  const fieldSources = useSmartProfileStore((state) => state.fieldSources);
  const updateProfileField = useSmartProfileStore((state) => state.updateProfileField);
  const markFieldAsEdited = useSmartProfileStore((state) => state.markFieldAsEdited);
  const clientId = useSmartProfileStore((state) => state.clientId);
  const selectedFormId = useSmartProfileStore((state) => state.selectedFormId);

  // Track whether user has dismissed the missing fields alert
  const [alertDismissed, setAlertDismissed] = React.useState(false);

  // Calculate missing fields for default form type (visa-application)
  // Phase 3 will add FormSuggester for proper form selection
  const formType = selectedFormId || 'visa-application';
  const missingFields = React.useMemo(
    () => getMissingFields(profileData as Record<string, unknown>, formType),
    [profileData, formType]
  );
  const suggestedDocuments = React.useMemo(
    () => getSuggestedDocuments(missingFields),
    [missingFields]
  );

  const handleFieldChange = (fieldName: string, newValue: unknown) => {
    updateProfileField(fieldName, newValue);
  };

  const handleFieldEdited = (fieldName: string) => {
    markFieldAsEdited(fieldName);
  };

  const handleDismissAlert = () => {
    setAlertDismissed(true);
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
            <Button onClick={onSaveProfile} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {clientId ? 'Update Profile' : 'Save Profile'}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Selection</CardTitle>
        <CardDescription>Choose forms to fill with your extracted profile data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {selectedFormId ? 'Form selected' : 'Form selection coming in Phase 3'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            FormSuggester component will replace this placeholder in Phase 3
          </p>
        </div>
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

      try {
        // Get detected files and their types
        const detectedFiles = uploadedFiles.filter((f) => f.status === 'detected');
        const fileIds = detectedFiles.map((f) => f.id);
        const files = fileObjectStore.getByIds(fileIds);
        const documentTypes = detectedFiles.map((f) => f.detectedType || 'OTHER');

        // Call extraction API
        const result = await extractBatch(files, documentTypes);

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
          const needsReview =
            result.lowConfidenceFields.length > 0 || extractedConflicts.length > 0;

          if (hasMultiplePeople) {
            // Multiple people detected - go to grouping step
            targetStep = 'grouping';
          } else if (!needsReview) {
            // Single person, no low confidence fields and no conflicts - skip to profile
            targetStep = 'profile';
          } else {
            // Single person, has low confidence fields or conflicts - go to review
            targetStep = 'review';
          }

          setCompletedSteps((prev) => new Set([...prev, step]));
          setStep(targetStep);
        } else {
          setExtractionError('Extraction failed. Please try again.');
        }
      } catch (error) {
        console.error('Extraction error:', error);
        setExtractionError(
          error instanceof Error ? error.message : 'Extraction failed. Please try again.'
        );
      } finally {
        setIsExtracting(false);
      }
      return;
    }

    // For other steps, just navigate
    setCompletedSteps((prev) => new Set([...prev, step]));
    setStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = getPreviousStep();
    if (prevStep) {
      setStep(prevStep);
    }
  };

  const handleReset = () => {
    reset();
    setCompletedSteps(new Set());
    setExtractionError(null);
    setSuggestedMerges([]);
    fileObjectStore.clear();
  };

  // Save profile to backend
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Generate a name from profile data
      const firstName = (profileData.firstName as string) || '';
      const lastName = (profileData.lastName as string) || '';
      const fullName = (profileData.fullName as string) || `${firstName} ${lastName}`.trim();
      const profileName = fullName || 'Extracted Profile';

      if (clientId) {
        // Update existing profile
        await profilesService.updateProfileData(clientId, profileData);
        toast.success('Profile updated successfully');
      } else {
        // Create new profile
        const newProfile = await profilesService.create({
          name: profileName,
          type: 'PERSONAL',
        });
        // Update profile data
        await profilesService.updateProfileData(newProfile.id, profileData);
        // Store the client ID for future updates
        setClientId(newProfile.id);
        toast.success('Profile saved successfully');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
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
        return <ProfileStepContent onSaveProfile={handleSaveProfile} isSaving={isSaving} />;
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

      {/* Step Indicator */}
      <Card className="overflow-hidden">
        <StepIndicator currentStep={step} completedSteps={completedSteps} />
      </Card>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
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
