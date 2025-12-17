import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUp, Download, Loader2, FileText, CheckCircle, ArrowRight, AlertCircle, Info, User } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api, { validateForm } from '@/services/api'
import { toast } from 'sonner'
import { FieldMappingTable } from '@/components/features/field-mapping-table'
import { TemplateManager } from '@/components/features/template-manager'
import { ProfileSelector } from '@/components/features/profile-selector'
import type { FormField, DocumentData, FieldMapping, MappingTemplate } from '@/types/formFilling'
import type { Profile } from '@/types/profile'
import { generateAutoMappings, validateMappings } from '@/utils/fieldMapping'

interface FillResult {
  documentId: string
  downloadUrl: string
  confidence: number
  filledFields: number
  totalFields: number
  warnings?: string[]
}

interface UserDataResponse {
  success: boolean
  data: DocumentData
  fieldSources: Record<string, Array<{ documentId: string; fileName: string; confidence: number | null }>>
  sources: Array<{ documentId: string; fileName: string; fileType: string; fields: string[]; confidence: number | null }>
  documentCount: number
  message?: string
}

export default function SimpleFillForm() {
  const [blankForm, setBlankForm] = useState<File | null>(null)
  const [filling, setFilling] = useState(false)
  const [result, setResult] = useState<FillResult | null>(null)
  const [currentStep, setCurrentStep] = useState<'upload' | 'map' | 'process'>('upload')
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [validatingForm, setValidatingForm] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)

  // Fetch ALL user's aggregated data (Phase 4B - User-centric approach)
  const { data: userData, isLoading: loadingUserData, error: userDataError } = useQuery<UserDataResponse>({
    queryKey: ['user-data'],
    queryFn: () => api.get('/users/me/data').then(res => res.data),
    staleTime: 60000, // Cache for 1 minute
    retry: 1
  })

  // Handle profile selection change
  const handleProfileChange = (profile: Profile | null) => {
    setSelectedProfile(profile)
    // Reset form state when profile changes
    if (currentStep !== 'upload') {
      setBlankForm(null)
      setFormFields([])
      setMappings([])
      setResult(null)
      setCurrentStep('upload')
    }
  }

  const handleFormUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        return
      }

      setBlankForm(file)
      setResult(null)
      setFormFields([])
      setMappings([])

      // Validate form and extract fields
      try {
        setValidatingForm(true)
        const validation = await validateForm(file)

        // Convert field names to FormField objects
        const fields: FormField[] = validation.fields.map((name) => ({
          name,
          type: validation.fieldTypes?.[name] || 'text',
          required: false,
        }))

        setFormFields(fields)

        // Check if user has any data
        if (!userData?.data || Object.keys(userData.data.fields || {}).length === 0) {
          toast.error('No user data available. Please upload documents first.')
          setBlankForm(null)
          return
        }

        // Auto-generate mappings from ALL user data
        const autoMappings = generateAutoMappings(fields, userData.data)
        setMappings(autoMappings)
        setCurrentStep('map')

        toast.success(`Form uploaded: ${file.name} (${fields.length} fields detected)`, {
          description: `Using data from ${userData.documentCount} document(s)`
        })
      } catch (error: any) {
        console.error('Form validation failed:', error)
        toast.error(error.response?.data?.error || 'Failed to validate form')
        setBlankForm(null)
      } finally {
        setValidatingForm(false)
      }
    }
  }

  const handleMappingChange = (formField: string, documentField: string | null) => {
    setMappings((prev) =>
      prev.map((m) =>
        m.formField === formField
          ? { ...m, documentField, manualOverride: true }
          : m
      )
    )
  }

  const handleResetMapping = (formField: string) => {
    if (!userData?.data) return

    // Reset to auto-mapping
    const autoMappings = generateAutoMappings(formFields, userData.data)
    const autoMapping = autoMappings.find((m) => m.formField === formField)

    if (autoMapping) {
      setMappings((prev) =>
        prev.map((m) => (m.formField === formField ? autoMapping : m))
      )
      toast.success('Mapping reset to auto-detection')
    }
  }

  const handleLoadTemplate = (template: MappingTemplate) => {
    // Apply template mappings to current mappings
    const updatedMappings = mappings.map((m) => ({
      ...m,
      documentField: template.mappings[m.formField] || m.documentField,
      manualOverride: !!template.mappings[m.formField],
    }))
    setMappings(updatedMappings)
    toast.success(`Template "${template.name}" loaded`)
  }

  const handleContinueToFill = () => {
    // Validate mappings
    const validation = validateMappings(formFields, mappings)
    if (!validation.valid) {
      toast.error(validation.errors[0])
      return
    }

    setCurrentStep('process')
    handleFillForm()
  }

  const handleFillForm = async () => {
    if (!blankForm || !userData) return

    try {
      setFilling(true)

      // Create form data with the blank form
      const formData = new FormData()
      formData.append('form', blankForm)

      // Add custom mappings
      const mappingsRecord: Record<string, string> = {}
      mappings.forEach((m) => {
        if (m.documentField) {
          mappingsRecord[m.formField] = m.documentField
        }
      })

      // Add the merged user data directly to the request
      formData.append('mappings', JSON.stringify(mappingsRecord))
      formData.append('userData', JSON.stringify(userData.data))

      // Use the new endpoint that fills using ALL user data
      const response = await api.post('/users/me/fill-form', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setResult({
        documentId: response.data.documentId,
        downloadUrl: response.data.downloadUrl,
        confidence: response.data.confidence,
        filledFields: response.data.filledFields,
        totalFields: formFields.length,
        warnings: response.data.warnings
      })

      toast.success('Form filled successfully!', {
        description: `${response.data.filledFields} fields filled with ${(response.data.confidence * 100).toFixed(0)}% confidence`
      })
    } catch (error: any) {
      console.error('Form filling failed:', error)
      toast.error(error.response?.data?.error || 'Failed to fill form')
      setCurrentStep('map')
    } finally {
      setFilling(false)
    }
  }

  const handleReset = () => {
    setBlankForm(null)
    setFormFields([])
    setMappings([])
    setResult(null)
    setCurrentStep('upload')
    // Note: We don't reset selectedProfile to keep the user's profile choice
  }

  const getFieldSource = (fieldName: string | null): string => {
    if (!fieldName || !userData?.fieldSources) return 'Unknown'
    const sources = userData.fieldSources[fieldName]
    if (!sources || sources.length === 0) return 'Unknown'

    if (sources.length === 1) {
      return sources[0].fileName
    }

    return `${sources[0].fileName} +${sources.length - 1} more`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Intelligent Form Filling</h1>
        <p className="text-muted-foreground">
          Select a profile and upload a blank form to auto-fill it with your data
        </p>
      </div>

      {/* Profile Selection */}
      <ProfileSelector
        selectedProfile={selectedProfile}
        onProfileChange={handleProfileChange}
        disabled={currentStep !== 'upload'}
      />

      {/* User Data Status Banner */}
      {loadingUserData ? (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>Loading your document data...</AlertDescription>
        </Alert>
      ) : userDataError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load your data. Please try refreshing the page.</AlertDescription>
        </Alert>
      ) : userData && userData.documentCount === 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>No documents found.</strong> Please upload and process some documents first (e.g., passport, visa, bank statements). The system will then auto-fill forms using that data.
          </AlertDescription>
        </Alert>
      ) : userData && userData.documentCount > 0 && selectedProfile ? (
        <Alert>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Ready to fill forms!</strong> Using profile "{selectedProfile.name}" with {userData.documentCount} processed document(s) and {Object.keys(userData.data.fields || {}).length} data fields.
          </AlertDescription>
        </Alert>
      ) : userData && userData.documentCount > 0 ? (
        <Alert>
          <User className="h-4 w-4" />
          <AlertDescription>
            <strong>Select a profile</strong> to continue. Your profile data will be used to auto-fill the form.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={currentStep} onValueChange={(value) => setCurrentStep(value as any)}>
        <TabsList>
          <TabsTrigger value="upload" disabled={currentStep !== 'upload'}>
            1. Upload Form
          </TabsTrigger>
          <TabsTrigger value="map" disabled={currentStep === 'upload' || !!result}>
            2. Review Auto-Fill
          </TabsTrigger>
          <TabsTrigger value="process" disabled={!result}>
            3. Download
          </TabsTrigger>
        </TabsList>

        {/* Step 1: Upload blank form */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="h-5 w-5" />
                Upload Blank Form
              </CardTitle>
              <CardDescription>
                Select a PDF form to fill. We'll auto-fill it using data from the selected profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="form-upload">Blank Form (PDF)</Label>
                  <Input
                    id="form-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handleFormUpload}
                    disabled={validatingForm || loadingUserData || userData?.documentCount === 0 || !selectedProfile}
                  />
                  {!selectedProfile && (
                    <p className="text-sm text-muted-foreground">
                      Please select a profile above before uploading a form
                    </p>
                  )}
                  {selectedProfile && userData?.documentCount === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Please upload documents first before filling forms
                    </p>
                  )}
                </div>
                {blankForm && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{blankForm.name}</span>
                    {validatingForm ? (
                      <Badge variant="outline" className="ml-auto">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Analyzing...
                      </Badge>
                    ) : (
                      <Badge variant="default" className="ml-auto">
                        {formFields.length} fields detected
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Review and adjust field mappings */}
        <TabsContent value="map">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Fill Preview</CardTitle>
                  <CardDescription>
                    Review AI-generated field mappings{selectedProfile ? ` for "${selectedProfile.name}"` : ''}. Data is sourced from {userData?.documentCount || 0} document(s).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userData && (
                    <FieldMappingTable
                      formFields={formFields}
                      documentData={userData.data}
                      mappings={mappings}
                      onMappingChange={handleMappingChange}
                      onResetMapping={handleResetMapping}
                      fieldSources={userData.fieldSources}
                    />
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep('upload')}>
                  Back to Upload
                </Button>
                <Button onClick={handleContinueToFill} disabled={filling}>
                  {filling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Filling Form...
                    </>
                  ) : (
                    <>
                      Fill Form
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Templates</CardTitle>
                  <CardDescription className="text-sm">
                    Save or load field mapping templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateManager
                    currentMappings={mappings}
                    onLoadTemplate={handleLoadTemplate}
                  />
                </CardContent>
              </Card>

              {/* Data Source Summary */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Data Sources</CardTitle>
                  <CardDescription className="text-sm">
                    Documents used for auto-fill
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {userData?.sources.map((source) => (
                      <div key={source.documentId} className="flex items-start gap-2 text-sm">
                        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{source.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {source.fields.length} fields
                            {source.confidence && ` • ${(source.confidence * 100).toFixed(0)}% confidence`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Step 3: Download result */}
        <TabsContent value="process">
          {result && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  Form Filled Successfully
                </CardTitle>
                <CardDescription>Your filled form is ready to download</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">Confidence</span>
                    <span className="font-medium text-lg">{(result.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Fields Filled</span>
                    <span className="font-medium text-lg">{result.filledFields}/{result.totalFields}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Data Sources</span>
                    <span className="font-medium text-lg">{userData?.documentCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Completion</span>
                    <span className="font-medium text-lg">
                      {((result.filledFields / result.totalFields) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {result.warnings && result.warnings.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warnings:</strong>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {result.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <a href={result.downloadUrl} download>
                      <Download className="h-4 w-4 mr-2" />
                      Download Filled Form
                    </a>
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    Fill Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
