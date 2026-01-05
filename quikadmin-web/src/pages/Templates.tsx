/**
 * Templates Page
 *
 * Manages field mapping templates. Users can:
 * - Browse saved templates
 * - Create new templates
 * - Delete templates
 * - Navigate to form filling with a template
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Clock,
  LayoutTemplate,
  Sparkles,
  Plus,
  Search,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

import {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getPublicTemplates,
  useTemplate as incrementTemplateUsage,
} from '@/services/formService';
import type { MappingTemplate } from '@/types/formFilling';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { StatCard } from '@/components/features/stat-card';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { PageHeader } from '@/components/layout/page-header';

interface TemplateCardProps {
  template: MappingTemplate;
  onUse: (template: MappingTemplate) => void;
  onDelete?: (id: string) => void;
  isPublic?: boolean;
}

const TemplateCard = ({ template, onUse, onDelete, isPublic }: TemplateCardProps) => {
  const getFieldCount = (t: MappingTemplate) => Object.keys(t.mappings || {}).length;
  const formatDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown';

  return (
    <motion.div variants={fadeInUp} layoutId={template.id} className="h-full">
      <div className="group relative h-full flex flex-col justify-between p-5 rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm transition-all hover:bg-card/60 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary mb-2 ring-1 ring-inset ring-primary/20">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            {isPublic && (
              <Badge
                variant="outline"
                className="bg-secondary/10 text-secondary border-secondary/20"
              >
                Public
              </Badge>
            )}
          </div>

          <h3
            className="font-heading font-semibold text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-1"
            title={template.name}
          >
            {template.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {template.description || 'No description provided.'}
          </p>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-white/5 p-2 rounded-lg">
            <span>Form Type</span>
            <span className="font-medium text-foreground">{template.formType || 'Custom'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3 w-3" />
              <span>{getFieldCount(template)} Fields</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Clock className="h-3 w-3" />
              <span>{formatDate(template.updatedAt || template.createdAt)}</span>
            </div>
          </div>

          {isPublic && template.author && (
            <div className="text-xs text-muted-foreground border-t border-white/5 pt-2 mt-2">
              By {template.author.firstName} {template.author.lastName}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto">
          <Button
            className="flex-1 shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-all text-xs"
            size="sm"
            onClick={() => onUse(template)}
          >
            <Sparkles className="mr-2 h-3 w-3" />
            Use Template
          </Button>

          {!isPublic && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
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
                    onClick={() => onDelete(template.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default function Templates() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateFormType, setNewTemplateFormType] = useState('CUSTOM');
  const [activeTab, setActiveTab] = useState('my-templates');

  // Fetch user's templates
  const {
    data: templates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: getTemplates,
  });

  // Fetch public templates (marketplace)
  const { data: publicTemplates = [], isLoading: isLoadingPublic } = useQuery({
    queryKey: ['publicTemplates'],
    queryFn: getPublicTemplates,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully');
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to create template';
      toast.error(message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete template';
      toast.error(message);
    },
  });

  const resetForm = () => {
    setNewTemplateName('');
    setNewTemplateDescription('');
    setNewTemplateFormType('CUSTOM');
  };

  const handleCreateTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    createMutation.mutate({
      name: newTemplateName.trim(),
      description: newTemplateDescription.trim() || undefined,
      formType: newTemplateFormType,
      fieldMappings: [], // Empty mappings
      mappings: {},
    });
  };

  const handleUseTemplate = async (template: MappingTemplate) => {
    try {
      await incrementTemplateUsage(template.id);
    } catch (error) {
      console.warn('Failed to increment usage count:', error);
    }
    navigate('/fill-form', { state: { templateId: template.id } });
  };

  const handleDeleteTemplate = (templateId: string) => {
    deleteMutation.mutate(templateId);
  };

  const filteredTemplates = useMemo(() => {
    const list = activeTab === 'my-templates' ? templates : publicTemplates;
    if (!searchTerm) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [activeTab, templates, publicTemplates, searchTerm]);

  // Derived stats
  const totalFields = useMemo(
    () => templates.reduce((sum, t) => sum + Object.keys(t.mappings || {}).length, 0),
    [templates]
  );
  const mostRecent = useMemo(() => {
    if (templates.length === 0) return 'None';
    const sorted = [...templates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return new Date(sorted[0].createdAt).toLocaleDateString();
  }, [templates]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Template Library"
        description="Manage your field mapping templates for automation."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Templates' }]}
      />

      {/* Stats Cards */}
      <ResponsiveGrid cols={3} gap="lg">
        <StatCard
          title="Total Templates"
          value={templates.length}
          description="Saved in your library"
          icon={LayoutTemplate}
          animationDelay={0}
          data-testid="stat-card-templates-1"
        />
        <StatCard
          title="Total Fields Mapped"
          value={totalFields}
          description="Across all templates"
          icon={FileText}
          animationDelay={0.1}
          data-testid="stat-card-templates-2"
        />
        <StatCard
          title="Last Activity"
          value={mostRecent}
          description="Most recent template"
          icon={Clock}
          animationDelay={0.2}
          data-testid="stat-card-templates-3"
        />
      </ResponsiveGrid>

      {/* Main Content */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="my-templates">My Templates</TabsTrigger>
              <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
              />
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30">
                  <Plus className="mr-2 h-4 w-4" /> New Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Start with a blank template. You can add field mappings during the form filling
                    process.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="t-name">Template Name</Label>
                    <Input
                      id="t-name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. Visa Application Setup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-type">Form Type</Label>
                    <Select value={newTemplateFormType} onValueChange={setNewTemplateFormType}>
                      <SelectTrigger id="t-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOM">Custom Form</SelectItem>
                        <SelectItem value="W2">W-2 Wage Statement</SelectItem>
                        <SelectItem value="I9">I-9 Eligibility</SelectItem>
                        <SelectItem value="PASSPORT">Passport Application</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="t-desc">Description</Label>
                    <Textarea
                      id="t-desc"
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Optional description..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTemplate}
                    disabled={createMutation.isPending || !newTemplateName}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      'Create'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isLoading || isLoadingPublic ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary/50" />
              <p>Loading library...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-10"
            >
              <EmptyState
                icon={activeTab === 'my-templates' ? LayoutTemplate : Search}
                title={
                  activeTab === 'my-templates' ? 'No templates created' : 'No marketplace templates'
                }
                description={
                  activeTab === 'my-templates'
                    ? 'Create your first template to start automating form filling.'
                    : 'Check back later for shared templates.'
                }
                action={
                  activeTab === 'my-templates'
                    ? {
                        label: 'Create Template',
                        onClick: () => setCreateDialogOpen(true),
                        icon: Plus,
                      }
                    : undefined
                }
              />
            </motion.div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show">
              <ResponsiveGrid preset="cards">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={handleUseTemplate}
                    onDelete={activeTab === 'my-templates' ? handleDeleteTemplate : undefined}
                    isPublic={activeTab === 'marketplace'}
                  />
                ))}
              </ResponsiveGrid>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
