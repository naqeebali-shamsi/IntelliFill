/**
 * Form Source Tabs Component
 *
 * Provides a tabbed interface for selecting a form source:
 * - Tab 1: Select from existing PDF templates
 * - Tab 2: Upload a new PDF form
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileUp, Library, Loader2, FileText, Calendar, Hash } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileUploadZone } from '@/components/features/file-upload-zone';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export interface FormTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  fileUrl?: string;
  detectedFields?: string[];
  fieldMappings?: Record<string, string>;
  fieldCount: number;
  mappedFieldCount: number;
  usageCount: number;
  createdAt: string;
  updatedAt?: string;
}

interface FormSourceTabsProps {
  onTemplateSelected: (template: FormTemplate) => void;
  onFileUploaded: (file: File) => void;
  disabled?: boolean;
}

// Category colors
const categoryColors: Record<string, string> = {
  VISA: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  COMPANY_FORMATION: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  LABOR: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  IMMIGRATION: 'bg-green-500/10 text-green-500 border-green-500/20',
  BANKING: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  GOVERNMENT: 'bg-red-500/10 text-red-500 border-red-500/20',
  OTHER: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: FormTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
        selected && 'border-primary ring-2 ring-primary/20'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
          </div>
          {template.category && (
            <Badge
              variant="outline"
              className={cn('text-xs shrink-0', categoryColors[template.category])}
            >
              {template.category.replace('_', ' ')}
            </Badge>
          )}
        </div>
        {template.description && (
          <CardDescription className="line-clamp-2 text-sm">{template.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {template.fieldCount} fields
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(template.createdAt), { addSuffix: true })}
          </span>
          {template.usageCount > 0 && <span>Used {template.usageCount}x</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export function FormSourceTabs({
  onTemplateSelected,
  onFileUploaded,
  disabled = false,
}: FormSourceTabsProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'upload'>('templates');

  // Fetch form templates
  const { data, isLoading, error } = useQuery({
    queryKey: ['form-templates'],
    queryFn: async () => {
      const response = await api.get('/form-templates');
      return response.data.data.templates as FormTemplate[];
    },
    staleTime: 60000,
  });

  const templates = data || [];

  const handleTemplateClick = (template: FormTemplate) => {
    setSelectedTemplateId(template.id);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplateId) return;

    // Fetch full template details including fileUrl and fieldMappings
    try {
      const response = await api.get(`/form-templates/${selectedTemplateId}`);
      const fullTemplate = response.data.data.template as FormTemplate;
      onTemplateSelected(fullTemplate);
    } catch (err) {
      console.error('Failed to fetch template details:', err);
    }
  };

  const handleFilesAccepted = (files: File[]) => {
    if (files.length > 0) {
      onFileUploaded(files[0]);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as 'templates' | 'upload')}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="templates" disabled={disabled}>
          <Library className="h-4 w-4 mr-2" />
          My Templates
        </TabsTrigger>
        <TabsTrigger value="upload" disabled={disabled}>
          <FileUp className="h-4 w-4 mr-2" />
          Upload PDF
        </TabsTrigger>
      </TabsList>

      <TabsContent value="templates" className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading templates...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-destructive">
            Failed to load templates. Please try again.
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">No templates yet</p>
            <Button variant="outline" onClick={() => setActiveTab('upload')}>
              <FileUp className="h-4 w-4 mr-2" />
              Upload your first form
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="grid gap-3">
                {templates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    selected={selectedTemplateId === template.id}
                    onSelect={() => handleTemplateClick(template)}
                  />
                ))}
              </div>
            </ScrollArea>

            {selectedTemplateId && (
              <div className="flex justify-end pt-2 border-t">
                <Button onClick={handleUseTemplate} disabled={disabled}>
                  Use Selected Template
                </Button>
              </div>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="upload" className="mt-4">
        <FileUploadZone
          onFilesAccepted={handleFilesAccepted}
          accept={{ 'application/pdf': ['.pdf'] }}
          maxSize={20 * 1024 * 1024} // 20MB
          maxFiles={1}
          multiple={false}
          disabled={disabled}
          showFileList={false}
        />
        <p className="text-xs text-muted-foreground text-center mt-3">
          Upload a blank PDF form. We'll detect all fillable fields automatically.
        </p>
      </TabsContent>
    </Tabs>
  );
}
