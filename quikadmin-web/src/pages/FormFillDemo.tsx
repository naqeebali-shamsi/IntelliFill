/**
 * Form Fill Demo Page
 *
 * Demonstrates the AutocompleteField component with intelligent suggestions.
 * Shows how profile data can be used to quickly fill out forms.
 *
 * @module pages/FormFillDemo
 */

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AutocompleteField } from '@/components/features/autocomplete-field';
import { FieldType, getSuggestionEngine } from '@/services/suggestionEngine';
import { Sparkles, FileText, RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Form data interface
 */
interface FormData {
  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;

  // Address Information
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  // Additional Information
  ssn: string;
  driversLicense: string;
  employerName: string;
  jobTitle: string;
  annualIncome: string;
}

/**
 * Initial empty form data
 */
const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  ssn: '',
  driversLicense: '',
  employerName: '',
  jobTitle: '',
  annualIncome: '',
};

/**
 * FormFillDemo Component
 */
export default function FormFillDemo() {
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasProfile, setHasProfile] = React.useState<boolean | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [filledFieldsCount, setFilledFieldsCount] = React.useState(0);

  const suggestionEngine = React.useMemo(() => getSuggestionEngine(), []);

  /**
   * Check if user has a profile
   */
  React.useEffect(() => {
    const checkProfile = async () => {
      setProfileLoading(true);
      try {
        const profile = await suggestionEngine.getUserProfile();
        setHasProfile(profile !== null && profile.fields.length > 0);
      } catch (error) {
        console.error('Failed to check profile:', error);
        setHasProfile(false);
      } finally {
        setProfileLoading(false);
      }
    };

    checkProfile();
  }, [suggestionEngine]);

  /**
   * Update form field
   */
  const handleFieldChange = (name: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Calculate filled fields
   */
  React.useEffect(() => {
    const filled = Object.values(formData).filter((value) => value.trim().length > 0).length;
    setFilledFieldsCount(filled);
  }, [formData]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success('Form submitted successfully!', {
      description: `${filledFieldsCount} of ${Object.keys(formData).length} fields completed`,
    });

    setIsSubmitting(false);
  };

  /**
   * Reset form
   */
  const handleReset = () => {
    setFormData(initialFormData);
    toast.info('Form cleared');
  };

  /**
   * Refresh profile cache
   */
  const handleRefreshProfile = async () => {
    try {
      await suggestionEngine.refreshProfile();
      toast.success('Profile data refreshed');
      setHasProfile(true);
    } catch (error) {
      toast.error('Failed to refresh profile');
    }
  };

  /**
   * Calculate completion percentage
   */
  const completionPercentage = Math.round(
    (filledFieldsCount / Object.keys(formData).length) * 100
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Smart Form Autofill Demo
            </h1>
            <p className="text-muted-foreground mt-2">
              Experience intelligent form filling powered by your profile data
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefreshProfile}
            disabled={profileLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Profile
          </Button>
        </div>

        {/* Profile Status Alert */}
        {!profileLoading && (
          <Alert variant={hasProfile ? 'default' : 'destructive'}>
            <div className="flex items-start gap-2">
              {hasProfile ? (
                <CheckCircle className="h-4 w-4 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription>
                  {hasProfile ? (
                    <span>
                      Profile data loaded successfully. Start typing in any field to see
                      intelligent suggestions.
                    </span>
                  ) : (
                    <span>
                      No profile data available. Upload some documents first to enable smart
                      suggestions.
                    </span>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Form Completion</CardTitle>
                <CardDescription>
                  {filledFieldsCount} of {Object.keys(formData).length} fields completed
                </CardDescription>
              </div>
              <Badge variant={completionPercentage === 100 ? 'default' : 'secondary'}>
                {completionPercentage}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Sample Application Form
              </CardTitle>
              <CardDescription>
                Click or type in any field to see autocomplete suggestions from your profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Personal Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AutocompleteField
                    name="firstName"
                    label="First Name"
                    placeholder="Enter your first name"
                    value={formData.firstName}
                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                    required
                  />

                  <AutocompleteField
                    name="lastName"
                    label="Last Name"
                    placeholder="Enter your last name"
                    value={formData.lastName}
                    onChange={(e) => handleFieldChange('lastName', e.target.value)}
                    required
                  />

                  <AutocompleteField
                    name="email"
                    label="Email Address"
                    fieldType={FieldType.EMAIL}
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    required
                  />

                  <AutocompleteField
                    name="phone"
                    label="Phone Number"
                    fieldType={FieldType.PHONE}
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    required
                  />

                  <AutocompleteField
                    name="dateOfBirth"
                    label="Date of Birth"
                    fieldType={FieldType.DATE}
                    placeholder="MM/DD/YYYY"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Address Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Address Information</h3>
                <div className="grid grid-cols-1 gap-4">
                  <AutocompleteField
                    name="streetAddress"
                    label="Street Address"
                    fieldType={FieldType.ADDRESS}
                    placeholder="123 Main St"
                    value={formData.streetAddress}
                    onChange={(e) => handleFieldChange('streetAddress', e.target.value)}
                    required
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AutocompleteField
                      name="city"
                      label="City"
                      fieldType={FieldType.ADDRESS}
                      placeholder="New York"
                      value={formData.city}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      required
                    />

                    <AutocompleteField
                      name="state"
                      label="State"
                      fieldType={FieldType.ADDRESS}
                      placeholder="NY"
                      value={formData.state}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      required
                    />

                    <AutocompleteField
                      name="zipCode"
                      label="ZIP Code"
                      fieldType={FieldType.ADDRESS}
                      placeholder="10001"
                      value={formData.zipCode}
                      onChange={(e) => handleFieldChange('zipCode', e.target.value)}
                      required
                    />
                  </div>

                  <AutocompleteField
                    name="country"
                    label="Country"
                    fieldType={FieldType.ADDRESS}
                    placeholder="United States"
                    value={formData.country}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Additional Information Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AutocompleteField
                    name="ssn"
                    label="Social Security Number"
                    fieldType={FieldType.SSN}
                    placeholder="XXX-XX-XXXX"
                    value={formData.ssn}
                    onChange={(e) => handleFieldChange('ssn', e.target.value)}
                  />

                  <AutocompleteField
                    name="driversLicense"
                    label="Driver's License"
                    placeholder="DL123456"
                    value={formData.driversLicense}
                    onChange={(e) => handleFieldChange('driversLicense', e.target.value)}
                  />

                  <AutocompleteField
                    name="employerName"
                    label="Employer Name"
                    placeholder="Company Inc."
                    value={formData.employerName}
                    onChange={(e) => handleFieldChange('employerName', e.target.value)}
                  />

                  <AutocompleteField
                    name="jobTitle"
                    label="Job Title"
                    placeholder="Software Engineer"
                    value={formData.jobTitle}
                    onChange={(e) => handleFieldChange('jobTitle', e.target.value)}
                  />

                  <AutocompleteField
                    name="annualIncome"
                    label="Annual Income"
                    fieldType={FieldType.NUMBER}
                    placeholder="$75,000"
                    value={formData.annualIncome}
                    onChange={(e) => handleFieldChange('annualIncome', e.target.value)}
                  />
                </div>
              </div>

              {/* Help Text */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>How to use:</strong> Start typing in any field to see suggestions from
                  your profile. Use arrow keys to navigate, Enter to select, or click a suggestion.
                  Confidence badges indicate data quality.
                </AlertDescription>
              </Alert>

              {/* Form Actions */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSubmitting}
                >
                  Clear Form
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting || filledFieldsCount === 0}
                    loading={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Intelligent Ranking</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Suggestions are ranked by field similarity, confidence, recency, and source count.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Keyboard Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Use arrow keys to navigate suggestions, Enter to select, and Escape to close.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confidence Indicators</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                High, Medium, and Low badges show data quality based on source reliability.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
