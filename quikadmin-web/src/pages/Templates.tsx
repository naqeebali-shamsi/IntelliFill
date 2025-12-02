/**
 * Templates Page
 * 
 * Manages field mapping templates. Users can:
 * - Browse saved templates
 * - Create new templates
 * - Delete templates
 * - Navigate to form filling with a template
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Eye, 
  Trash2, 
  Plus,
  Search,
  Clock,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTemplates, createTemplate, deleteTemplate, getPublicTemplates, useTemplate } from '@/services/formService';
import type { MappingTemplate } from '@/types/formFilling';
import { toast } from 'sonner';

export default function Templates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateFormType, setNewTemplateFormType] = useState('CUSTOM');
  const [activeTab, setActiveTab] = useState('my-templates');

  // Fetch user's templates
  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ['templates'],
    queryFn: getTemplates,
  });

  // Fetch public templates (marketplace)
  const { data: publicTemplates = [], isLoading: isLoadingPublic } = useQuery({
    queryKey: ['publicTemplates'],
    queryFn: getPublicTemplates,
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
      setCreateDialogOpen(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create template');
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete template');
    },
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (template.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    createMutation.mutate({
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim() || undefined,
      formType: newTemplateFormType,
      fieldMappings: [], // Empty mappings - user will create mappings in form filling page
      mappings: {}, // Keep for backwards compatibility
    });
  };

  const handleUseTemplate = async (template: MappingTemplate) => {
    // Increment usage count
    try {
      await useTemplate(template.id);
    } catch (error) {
      console.warn('Failed to increment usage count:', error);
    }

    // Navigate to form filling page with template preselected
    navigate('/fill-form', { state: { templateId: template.id } });
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteMutation.mutate(templateId);
  };

  const getFieldCount = (template: MappingTemplate): number => {
    return Object.keys(template.mappings || {}).length;
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Unknown';
    }
  };

  const TemplateCard = ({ template }: { template: MappingTemplate }) => (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{template.name}</CardTitle>
            {template.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {template.description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Field Mappings:</span>
            <span className="font-medium">{getFieldCount(template)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium">{formatDate(template.createdAt)}</span>
          </div>
          {template.updatedAt && template.updatedAt !== template.createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Updated:</span>
              <span className="font-medium">{formatDate(template.updatedAt)}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleUseTemplate(template)}
          >
            <ArrowRight className="mr-2 h-3 w-3" />
            Use Template
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Template</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete the template "{template.name}"?
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
        <p className="text-muted-foreground">
          Manage your field mapping templates for quick form filling
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">Saved mapping templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((sum, t) => sum + getFieldCount(t), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all templates</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {templates.length > 0 
                ? formatDate(templates.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )[0]?.createdAt)
                : 'No templates'}
            </div>
            <p className="text-xs text-muted-foreground">Most recent template</p>
          </CardContent>
        </Card>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load templates. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      )}

      {/* Templates List with Tabs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Template Library</CardTitle>
              <CardDescription>
                Browse and manage your field mapping templates
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a new template. You'll be able to add field mappings when you use it.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name *</Label>
                    <Input
                      id="template-name"
                      placeholder="e.g., Customer Information Form"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-form-type">Form Type *</Label>
                    <Select value={newTemplateFormType} onValueChange={setNewTemplateFormType}>
                      <SelectTrigger id="template-form-type">
                        <SelectValue placeholder="Select form type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="W2">W-2 Wage and Tax Statement</SelectItem>
                        <SelectItem value="I9">I-9 Employment Eligibility</SelectItem>
                        <SelectItem value="PASSPORT">Passport Application</SelectItem>
                        <SelectItem value="JOB_APPLICATION">Job Application</SelectItem>
                        <SelectItem value="CUSTOM">Custom Form</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-description">Description (Optional)</Label>
                    <Textarea
                      id="template-description"
                      placeholder="Describe when to use this template..."
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateDialogOpen(false);
                      setNewTemplateName('');
                      setNewTemplateDescription('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTemplate}
                    disabled={createMutation.isLoading || !newTemplateName.trim()}
                  >
                    {createMutation.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Template'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Tabs for My Templates and Marketplace */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="my-templates">My Templates</TabsTrigger>
                <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              </TabsList>

              <TabsContent value="my-templates" className="space-y-4">
            {/* Templates Grid/List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading templates...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchTerm ? 'No templates found' : 'No templates yet'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm
                    ? 'Try adjusting your search terms'
                    : 'Create your first template to get started'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map(template => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map(template => (
                  <Card key={template.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{template.name}</h3>
                            <Badge variant="secondary">{getFieldCount(template)} fields</Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground truncate">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span>Created {formatDate(template.createdAt)}</span>
                            {template.updatedAt && template.updatedAt !== template.createdAt && (
                              <span>Updated {formatDate(template.updatedAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseTemplate(template)}
                        >
                          <ArrowRight className="mr-2 h-3 w-3" />
                          Use
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{template.name}"? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
              </TabsContent>

              <TabsContent value="marketplace" className="space-y-4">
                {/* Marketplace Templates Grid/List */}
                {isLoadingPublic ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading marketplace templates...</span>
                  </div>
                ) : publicTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No public templates available</h3>
                    <p className="text-muted-foreground">
                      Check back later for community-shared templates
                    </p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {publicTemplates.map(template => (
                      <Card key={template.id} className="h-full flex flex-col hover:shadow-md transition-shadow">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg truncate">{template.name}</CardTitle>
                              <CardDescription className="mt-1 line-clamp-2">
                                {template.description || 'No description'}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Form Type:</span>
                              <Badge variant="outline">{template.formType || 'CUSTOM'}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Usage Count:</span>
                              <span className="font-medium">{template.usageCount || 0}</span>
                            </div>
                            {template.author && (
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Author:</span>
                                <span className="font-medium text-xs">
                                  {template.author.firstName} {template.author.lastName}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        <CardContent className="pt-0">
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => handleUseTemplate(template)}
                          >
                            <ArrowRight className="mr-2 h-3 w-3" />
                            Use Template
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {publicTemplates.map(template => (
                      <Card key={template.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{template.name}</h3>
                                <Badge variant="outline">{template.formType || 'CUSTOM'}</Badge>
                                <Badge variant="secondary">{template.usageCount || 0} uses</Badge>
                              </div>
                              {template.description && (
                                <p className="text-sm text-muted-foreground truncate">
                                  {template.description}
                                </p>
                              )}
                              {template.author && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  by {template.author.firstName} {template.author.lastName}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleUseTemplate(template)}
                          >
                            <ArrowRight className="mr-2 h-3 w-3" />
                            Use
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
