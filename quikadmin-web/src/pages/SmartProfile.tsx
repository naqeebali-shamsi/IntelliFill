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
} from 'lucide-react';
import { SmartUploadZone } from '@/components/smart-profile';

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

function GroupingStepContent() {
  const detectedPeople = useSmartProfileStore((state) => state.detectedPeople);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Person Grouping</CardTitle>
        <CardDescription>
          Organize documents by person if multiple people were detected
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {detectedPeople.length > 0
              ? `${detectedPeople.length} person(s) detected`
              : 'Person grouping will appear here'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            PersonGrouper component will replace this placeholder in Phase 2
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStepContent() {
  const lowConfidenceFields = useSmartProfileStore((state) => state.lowConfidenceFields);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Extracted Data</CardTitle>
        <CardDescription>Verify fields that need attention due to low confidence</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {lowConfidenceFields.length > 0
              ? `${lowConfidenceFields.length} field(s) need review`
              : 'All fields extracted with high confidence'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            ConfidenceReview component will replace this placeholder in Phase 2
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileStepContent() {
  const profileData = useSmartProfileStore((state) => state.profileData);
  const fieldCount = Object.keys(profileData).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile View</CardTitle>
        <CardDescription>Your extracted profile data organized by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <User className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {fieldCount > 0
              ? `${fieldCount} field(s) extracted`
              : 'Profile data will appear here after extraction'}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            ProfileView component will replace this placeholder in Plan 01-04
          </p>
        </div>
      </CardContent>
    </Card>
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

  // Get store actions for updating extraction results
  const setProfileData = useSmartProfileStore((state) => state.setProfileData);
  const setFieldSources = useSmartProfileStore((state) => state.setFieldSources);
  const setLowConfidenceFields = useSmartProfileStore((state) => state.setLowConfidenceFields);
  const uploadedFiles = useSmartProfileStore((state) => state.uploadedFiles);

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

          // Determine next step based on extraction results
          // Skip grouping for now (Phase 2), skip review if no low confidence fields
          let targetStep: WizardStep = nextStep;
          if (result.lowConfidenceFields.length === 0) {
            targetStep = 'profile';
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
    fileObjectStore.clear();
  };

  // Render step content based on current step
  const renderStepContent = () => {
    switch (step) {
      case 'upload':
        return <UploadStepContent />;
      case 'grouping':
        return <GroupingStepContent />;
      case 'review':
        return <ReviewStepContent />;
      case 'profile':
        return <ProfileStepContent />;
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
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Smart Profile' }]}
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
