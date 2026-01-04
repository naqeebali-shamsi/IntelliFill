import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileUp,
  Download,
  Loader2,
  FileText,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  Info,
  User,
  Check,
  Upload,
  Sparkles,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import api, { validateForm } from '@/services/api';

import { FieldMappingTable } from '@/components/features/field-mapping-table';
import { TemplateManager } from '@/components/features/template-manager';
import { ProfileSelector } from '@/components/features/profile-selector';
import type { FormField, DocumentData, FieldMapping, MappingTemplate } from '@/types/formFilling';
import type { Profile } from '@/types/profile';
import { generateAutoMappings, validateMappings } from '@/utils/fieldMapping';

interface FillResult {
  documentId: string;
  downloadUrl: string;
  confidence: number;
  filledFields: number;
  totalFields: number;
  warnings?: string[];
}

interface UserDataResponse {
  success: boolean;
  data: {
    fields: Record<string, any>;
    entities: Record<string, any[]>;
    metadata: Record<string, any>;
  };
  fieldSources: Record<
    string,
    Array<{ documentId: string; fileName: string; confidence: number | null }>
  >;
  sources: Array<{
    documentId: string;
    fileName: string;
    fileType: string;
    fields: string[];
    confidence: number | null;
  }>;
  documentCount: number;
  message?: string;
}

interface ProfileDataResponse {
  success: boolean;
  data: {
    clientId: string;
    clientName: string;
    clientType: string;
    profile: {
      id: string;
      data: Record<string, any>;
      categorizedData: Record<string, any>;
      fieldSources: Record<string, any>;
      createdAt: string;
      updatedAt: string;
    };
  };
}

// Animation Variants
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

// Stepper Component
const FormStepper = ({ currentStep }: { currentStep: 'upload' | 'map' | 'process' }) => {
  const steps = [
    { id: 'upload', label: 'Upload', icon: Upload },
    { id: 'map', label: 'Review & Map', icon: Settings2 },
    { id: 'process', label: 'Download', icon: Download },
  ];

  const getStepIndex = (stepId: string) => steps.findIndex((s) => s.id === stepId);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="relative flex items-center justify-between mb-8 px-4">
      {/* Connector Lines */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-white/10 -z-10" />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-in-out -z-10"
        style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const Icon = step.icon;

        return (
          <div
            key={step.id}
            className="flex flex-col items-center bg-background/5 p-2 rounded-xl backdrop-blur-sm"
          >
            <div
              className={cn(
                'relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110'
                  : isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted bg-background text-muted-foreground'
              )}
            >
              {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
            <span
              className={cn(
                'mt-2 text-xs font-medium transition-colors',
                isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default function SimpleFillForm() {
  const [blankForm, setBlankForm] = useState<File | null>(null);
  const [filling, setFilling] = useState(false);
  const [result, setResult] = useState<FillResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'process'>('upload');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [validatingForm, setValidatingForm] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [direction, setDirection] = useState(0); // For animation direction

  // Fetch ALL user's aggregated data
  const {
    data: userData,
    isLoading: loadingUserData,
    error: userDataError,
  } = useQuery<UserDataResponse>({
    queryKey: ['user-data'],
    queryFn: () => api.get('/users/me/data').then((res) => res.data),
    staleTime: 60000,
    retry: 1,
  });

  // Fetch selected profile's data
  const {
    data: profileData,
    isLoading: loadingProfileData,
    error: profileDataError,
  } = useQuery<ProfileDataResponse>({
    queryKey: ['profile-data', selectedProfile?.id],
    queryFn: () => api.get(`/clients/${selectedProfile!.id}/profile`).then((res) => res.data),
    enabled: !!selectedProfile?.id,
    staleTime: 30000,
    retry: 1,
  });

  const effectiveData = useMemo(() => {
    if (selectedProfile && profileData?.data?.profile?.data) {
      const profileFields = profileData.data.profile.data;
      const fieldCount = Object.keys(profileFields).length;
      if (fieldCount > 0) {
        return {
          fields: profileFields,
          fieldSources: profileData.data.profile.fieldSources || {},
          source: 'profile' as const,
          fieldCount,
        };
      }
    }

    if (userData?.data?.fields) {
      const fieldCount = Object.keys(userData.data.fields).length;
      return {
        fields: userData.data.fields,
        fieldSources: userData.fieldSources || {},
        source: 'documents' as const,
        fieldCount,
      };
    }

    return { fields: {}, fieldSources: {}, source: 'none' as const, fieldCount: 0 };
  }, [selectedProfile, profileData, userData]);

  const handleProfileChange = (profile: Profile | null) => {
    setSelectedProfile(profile);
    if (currentStep !== 'upload') {
      setBlankForm(null);
      setFormFields([]);
      setMappings([]);
      setResult(null);
      setCurrentStep('upload');
      setDirection(-1);
    }
  };

  const handleFormUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }

      setBlankForm(file);
      setResult(null);
      setFormFields([]);
      setMappings([]);

      try {
        setValidatingForm(true);
        const validation = await validateForm(file);
        const fields: FormField[] = validation.fields.map((name) => ({
          name,
          type: validation.fieldTypes?.[name] || 'text',
          required: false,
        }));

        setFormFields(fields);

        if (effectiveData.fieldCount === 0) {
          if (selectedProfile) {
            toast.error('No profile data available. Please add data to this profile first.');
          } else {
            toast.error(
              'No user data available. Please upload documents or select a profile first.'
            );
          }
          setBlankForm(null);
          return;
        }

        const autoMappings = generateAutoMappings(fields, effectiveData.fields);
        setMappings(autoMappings);

        setDirection(1);
        setCurrentStep('map');

        const sourceDescription =
          effectiveData.source === 'profile'
            ? `profile "${selectedProfile?.name}"`
            : `${userData?.documentCount || 0} document(s)`;
        toast.success(`Form uploaded: ${file.name}`, {
          description: `Using ${effectiveData.fieldCount} fields from ${sourceDescription}`,
        });
      } catch (error: unknown) {
        console.error('Form validation failed:', error);
        const message =
          (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Failed to validate form';
        toast.error(message);
        setBlankForm(null);
      } finally {
        setValidatingForm(false);
      }
    }
  };

  const handleMappingChange = (formField: string, documentField: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.formField === formField ? { ...m, documentField, manualOverride: true } : m
      )
    );
  };

  const handleResetMapping = (formField: string) => {
    if (effectiveData.fieldCount === 0) return;
    const autoMappings = generateAutoMappings(formFields, effectiveData.fields);
    const autoMapping = autoMappings.find((m) => m.formField === formField);
    if (autoMapping) {
      setMappings((prev) => prev.map((m) => (m.formField === formField ? autoMapping : m)));
      toast.success('Mapping reset to auto-detection');
    }
  };

  const handleLoadTemplate = (template: MappingTemplate) => {
    const updatedMappings = mappings.map((m) => ({
      ...m,
      documentField: template.mappings[m.formField] || m.documentField,
      manualOverride: !!template.mappings[m.formField],
    }));
    setMappings(updatedMappings);
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleContinueToFill = () => {
    const validation = validateMappings(formFields, mappings);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }
    setDirection(1);
    setCurrentStep('process');
    handleFillForm();
  };

  const handleFillForm = async () => {
    if (!blankForm || effectiveData.fieldCount === 0) return;

    try {
      setFilling(true);
      const formData = new FormData();
      formData.append('form', blankForm);
      const mappingsRecord: Record<string, string> = {};
      mappings.forEach((m) => {
        if (m.documentField) mappingsRecord[m.formField] = m.documentField;
      });

      const dataPayload =
        effectiveData.source === 'profile'
          ? { fields: effectiveData.fields }
          : userData?.data || { fields: effectiveData.fields };

      formData.append('mappings', JSON.stringify(mappingsRecord));
      formData.append('userData', JSON.stringify(dataPayload));

      const response = await api.post('/users/me/fill-form', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult({
        documentId: response.data.documentId,
        downloadUrl: response.data.downloadUrl,
        confidence: response.data.confidence,
        filledFields: response.data.filledFields,
        totalFields: formFields.length,
        warnings: response.data.warnings,
      });

      toast.success('Form filled successfully!');
    } catch (error: unknown) {
      console.error('Form filling failed:', error);
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to fill form';
      toast.error(message);
      setDirection(-1);
      setCurrentStep('map');
    } finally {
      setFilling(false);
    }
  };

  const handleReset = () => {
    setBlankForm(null);
    setFormFields([]);
    setMappings([]);
    setResult(null);
    setDirection(-1);
    setCurrentStep('upload');
  };

  const handleDownload = async () => {
    if (!result?.downloadUrl) return;
    try {
      const response = await api.get(result.downloadUrl.replace(/^\/api/, ''), {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `filled-form-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to download file';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">
          Intelligent Fill
        </h1>
        <p className="text-muted-foreground text-lg">
          Auto-fill PDF forms using your saved profile data.
        </p>
      </div>

      <FormStepper currentStep={currentStep} />

      <motion.div
        key={currentStep}
        custom={direction}
        variants={stepVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 300, damping: 30 },
          opacity: { duration: 0.2 },
        }}
        className="glass-panel p-6 rounded-2xl border border-white/10"
      >
        {currentStep === 'upload' && (
          <div className="space-y-8">
            {/* Profile Selection - Prominent */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/5">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                1. Select Identity Source
              </h3>
              <ProfileSelector
                selectedProfile={selectedProfile}
                onProfileChange={handleProfileChange}
                disabled={currentStep !== 'upload'}
              />

              {/* Data Status */}
              <div className="mt-4">
                {effectiveData.fieldCount > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 px-3 py-2 rounded-lg w-fit">
                    <CheckCircle className="h-4 w-4" />
                    <span>
                      Ready: {effectiveData.fieldCount} fields available from{' '}
                      {effectiveData.source === 'profile' ? 'profile' : 'documents'}
                    </span>
                  </div>
                ) : selectedProfile ? (
                  <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-3 py-2 rounded-lg w-fit">
                    <Info className="h-4 w-4" />
                    <span>Profile has no data. Add data or upload documents to continue.</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground ml-2">
                    Select a profile to see available data.
                  </div>
                )}
              </div>
            </div>

            {/* Upload Drop Zone */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                2. Upload Target Form
              </h3>

              <div
                className={cn(
                  'border-2 border-dashed border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-primary/30 transition-all cursor-pointer relative',
                  (!selectedProfile || effectiveData.fieldCount === 0) &&
                    'opacity-50 pointer-events-none'
                )}
              >
                <Input
                  id="form-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleFormUpload}
                  disabled={validatingForm || !selectedProfile || effectiveData.fieldCount === 0}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-4 rounded-full bg-primary/10 text-primary mb-4">
                  {validatingForm ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8" />
                  )}
                </div>
                <h4 className="text-lg font-medium mb-1">
                  {validatingForm ? 'Analyzing Form...' : 'Drop your PDF here'}
                </h4>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'map' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Review Mappings</h2>
                  <p className="text-sm text-muted-foreground">Verify how fields will be filled</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary">
                    {mappings.filter((m) => m.documentField).length}/{formFields.length} Mapped
                  </Badge>
                </div>
              </div>

              <div className="bg-background/20 rounded-xl border border-white/5 overflow-hidden">
                <FieldMappingTable
                  formFields={formFields}
                  documentData={effectiveData.fields}
                  mappings={mappings}
                  onMappingChange={handleMappingChange}
                  onResetMapping={handleResetMapping}
                  fieldSources={
                    effectiveData.source === 'profile' ? {} : userData?.fieldSources || {}
                  }
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDirection(-1);
                    setCurrentStep('upload');
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleContinueToFill}
                  disabled={filling}
                  className="shadow-lg shadow-primary/20"
                >
                  {filling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Fill Form
                </Button>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Templates</CardTitle>
                  <CardDescription>Apply saved mappings</CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateManager currentMappings={mappings} onLoadTemplate={handleLoadTemplate} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {currentStep === 'process' && result && (
          <div className="max-w-2xl mx-auto text-center py-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-green-500/5"
            >
              <CheckCircle className="h-10 w-10" />
            </motion.div>

            <h2 className="text-2xl font-bold mb-2">Form Filled Successfully!</h2>
            <p className="text-muted-foreground mb-8">
              Your document has been processed and is ready.
            </p>

            <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
              <div className="bg-white/5 p-4 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">Confidence Score</div>
                <div className="text-2xl font-mono font-bold">
                  {(result.confidence * 100).toFixed(0)}%
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-xl">
                <div className="text-sm text-muted-foreground mb-1">Fields Filled</div>
                <div className="text-2xl font-mono font-bold">
                  {result.filledFields}/{result.totalFields}
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={handleReset}>
                Start Over
              </Button>
              <Button onClick={handleDownload} size="lg" className="shadow-xl shadow-primary/20">
                <Download className="mr-2 h-5 w-5" />
                Download PDF
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
