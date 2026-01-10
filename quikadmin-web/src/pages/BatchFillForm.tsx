/**
 * BatchFillForm - Batch form filling page
 * Allows selecting multiple templates and profiles to generate filled forms in batch
 * @module pages/BatchFillForm
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, FileText, Users, Download, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/layout/page-header';
import api from '@/services/api';
import { cn } from '@/lib/utils';

// Types
interface FormTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  fieldCount: number;
  usageCount: number;
}

interface Profile {
  id: string;
  name: string;
  type: 'PERSONAL' | 'BUSINESS';
  status: string;
}

interface BatchResult {
  templateId: string;
  templateName: string;
  profileId: string;
  profileName: string;
  success: boolean;
  documentId?: string;
  downloadUrl?: string;
  error?: string;
}

interface BatchResponse {
  success: boolean;
  results: BatchResult[];
  totalGenerated: number;
  totalFailed: number;
}

// Template Selection Card
function TemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: FormTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary/20 bg-primary/5'
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox checked={selected} className="mt-1" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{template.name}</span>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                {template.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{template.fieldCount} fields</span>
              {template.category && (
                <Badge variant="outline" className="text-xs">
                  {template.category.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Profile Selection Card
function ProfileCard({
  profile,
  selected,
  onToggle,
}: {
  profile: Profile;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50',
        selected && 'border-primary ring-2 ring-primary/20 bg-primary/5'
      )}
      onClick={onToggle}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Checkbox checked={selected} />
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
              profile.type === 'BUSINESS'
                ? 'bg-primary/10 text-primary'
                : 'bg-status-success/10 text-status-success-foreground'
            )}
          >
            <Users className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{profile.name}</div>
            <div className="text-xs text-muted-foreground">
              {profile.type === 'BUSINESS' ? 'Business' : 'Personal'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Results Table
function BatchResultsTable({ results }: { results: BatchResult[] }) {
  const handleDownload = async (downloadUrl: string, fileName: string) => {
    try {
      const response = await api.get(downloadUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const successCount = results.filter((r) => r.success).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-status-success" />
          Batch Results
        </CardTitle>
        <CardDescription>
          {successCount} of {results.length} forms generated successfully
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Profile</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result, index) => (
              <TableRow key={`${result.templateId}-${result.profileId}-${index}`}>
                <TableCell className="font-medium">{result.templateName}</TableCell>
                <TableCell>{result.profileName}</TableCell>
                <TableCell>
                  {result.success ? (
                    <Badge className="bg-status-success/10 text-status-success-foreground">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Success
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {result.success && result.downloadUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleDownload(
                          result.downloadUrl!,
                          `${result.templateName}-${result.profileName}.pdf`
                        )
                      }
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  )}
                  {!result.success && result.error && (
                    <span className="text-sm text-destructive">{result.error}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BatchFillForm() {
  const [selectedTemplates, setSelectedTemplates] = useState<FormTemplate[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Profile[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);

  // Fetch templates
  const { data: templatesData, isLoading: loadingTemplates } = useQuery({
    queryKey: ['form-templates-batch'],
    queryFn: async () => {
      const response = await api.get('/form-templates');
      return response.data.data.templates as FormTemplate[];
    },
  });

  // Fetch profiles
  const { data: profilesData, isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles-batch'],
    queryFn: async () => {
      const response = await api.get('/clients', { params: { status: 'ACTIVE', limit: 100 } });
      return response.data.data.clients.map(
        (c: { id: string; name: string; type: string; status: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
        })
      ) as Profile[];
    },
  });

  const templates = templatesData || [];
  const profiles = profilesData || [];

  // Batch processing mutation
  const batchMutation = useMutation({
    mutationFn: async (combinations: { templateId: string; profileId: string }[]) => {
      const response = await api.post<BatchResponse>('/filled-forms/batch', { combinations });
      return response.data;
    },
    onSuccess: (data) => {
      setResults(data.results);
      if (data.totalFailed === 0) {
        toast.success(`Successfully generated ${data.totalGenerated} forms!`);
      } else {
        toast.warning(`Generated ${data.totalGenerated} forms, ${data.totalFailed} failed`);
      }
    },
    onError: () => {
      toast.error('Failed to process batch. Please try again.');
    },
  });

  function toggleItem<T extends { id: string }>(
    item: T,
    setSelected: React.Dispatch<React.SetStateAction<T[]>>
  ): void {
    setSelected((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      return exists ? prev.filter((i) => i.id !== item.id) : [...prev, item];
    });
  }

  function toggleAll<T>(
    items: T[],
    selected: T[],
    setSelected: React.Dispatch<React.SetStateAction<T[]>>
  ): void {
    setSelected(selected.length === items.length ? [] : [...items]);
  }

  const handleProcess = () => {
    const combinations = selectedTemplates.flatMap((t) =>
      selectedProfiles.map((p) => ({ templateId: t.id, profileId: p.id }))
    );
    batchMutation.mutate(combinations);
  };

  const totalCombinations = selectedTemplates.length * selectedProfiles.length;
  const canProcess = selectedTemplates.length > 0 && selectedProfiles.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Fill Forms"
        description="Generate multiple filled forms by selecting templates and profiles"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Templates Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Select Templates
                </CardTitle>
                <CardDescription>
                  {selectedTemplates.length} of {templates.length} selected
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAll(templates, selectedTemplates, setSelectedTemplates)}
              >
                {selectedTemplates.length === templates.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingTemplates ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No templates found</p>
                <p className="text-sm">Create a template first</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {templates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      selected={selectedTemplates.some((t) => t.id === template.id)}
                      onToggle={() => toggleItem(template, setSelectedTemplates)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Profiles Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Select Profiles
                </CardTitle>
                <CardDescription>
                  {selectedProfiles.length} of {profiles.length} selected
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleAll(profiles, selectedProfiles, setSelectedProfiles)}
              >
                {selectedProfiles.length === profiles.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingProfiles ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No profiles found</p>
                <p className="text-sm">Create a profile first</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {profiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      selected={selectedProfiles.some((p) => p.id === profile.id)}
                      onToggle={() => toggleItem(profile, setSelectedProfiles)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary and Action */}
      <Card className={cn(canProcess && 'border-primary/50')}>
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  canProcess ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">
                  {totalCombinations > 0 ? (
                    <>
                      {totalCombinations} form{totalCombinations !== 1 ? 's' : ''} will be generated
                    </>
                  ) : (
                    'Select templates and profiles'
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} ×{' '}
                  {selectedProfiles.length} profile{selectedProfiles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleProcess}
              disabled={!canProcess || batchMutation.isPending}
            >
              {batchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Generate All
                </>
              )}
            </Button>
          </div>

          {batchMutation.isPending && (
            <div className="mt-4">
              <Progress value={undefined} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Processing {totalCombinations} combinations...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && <BatchResultsTable results={results} />}
    </div>
  );
}
