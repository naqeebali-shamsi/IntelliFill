/**
 * TemplateLibrary Page
 *
 * A comprehensive template library page with grid/list view toggle,
 * search, category filtering, sorting, duplication and preview capabilities.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Grid3X3, List, Loader2, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { ResponsiveGrid } from '@/components/layout/responsive-grid';
import { EmptyState } from '@/components/ui/empty-state';
import { staggerContainer } from '@/lib/animations';
import {
  TemplateCard,
  TemplateCardSkeleton,
  type Template,
  type TemplateCategory,
} from '@/components/features/TemplateCard';
import { TemplatePreviewModal } from '@/components/features/TemplatePreviewModal';
import {
  getTemplates,
  deleteTemplate,
  duplicateTemplate,
  useTemplate as incrementTemplateUsage,
} from '@/services/formService';
import type { MappingTemplate } from '@/types/formFilling';

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'date' | 'uses';

const categories: { value: TemplateCategory; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'legal', label: 'Legal' },
  { value: 'financial', label: 'Financial' },
  { value: 'hr', label: 'HR' },
  { value: 'medical', label: 'Medical' },
  { value: 'custom', label: 'Custom' },
];

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date Modified' },
  { value: 'uses', label: 'Most Used' },
];

/**
 * Map form type to category based on keywords in the form type string
 */
function formTypeToCategory(formType?: string): TemplateCategory {
  if (!formType) return 'custom';

  const type = formType.toUpperCase();

  const categoryKeywords: Record<Exclude<TemplateCategory, 'all' | 'custom'>, string[]> = {
    financial: ['W2', 'W-2', 'TAX', 'INVOICE'],
    hr: ['I9', 'I-9', 'EMPLOY', 'HR'],
    legal: ['LEGAL', 'ATTORNEY', 'CONTRACT'],
    medical: ['MEDICAL', 'HEALTH', 'PATIENT'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => type.includes(keyword))) {
      return category as TemplateCategory;
    }
  }

  return 'custom';
}

/**
 * Transform MappingTemplate to Template for TemplateCard
 */
function transformTemplate(t: MappingTemplate): Template {
  return {
    id: t.id,
    name: t.name,
    description: t.description || '',
    category: formTypeToCategory(t.formType),
    usageCount: t.usageCount || 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt || t.createdAt,
    fieldCount: t.fieldMappings?.length || Object.keys(t.mappings || {}).length,
  };
}

export default function TemplateLibrary(): React.ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');

  // Preview modal state
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Delete confirmation state
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [deleteTemplateName, setDeleteTemplateName] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Fetch templates
  const {
    data: rawTemplates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['templates'],
    queryFn: getTemplates,
  });

  // Transform templates for TemplateCard
  const templates = useMemo(() => rawTemplates.map(transformTemplate), [rawTemplates]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully');
      setIsDeleteDialogOpen(false);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to delete template';
      toast.error(message);
    },
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template duplicated');
      // Navigate to editor for the new template
      navigate(`/templates/edit/${newTemplate.id}`);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to duplicate template';
      toast.error(message);
    },
  });

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'uses':
          return b.usageCount - a.usageCount;
        default:
          return 0;
      }
    });

    return result;
  }, [templates, searchQuery, selectedCategory, sortBy]);

  // Handlers
  const handleTemplateClick = async (id: string) => {
    // Increment usage count silently
    try {
      await incrementTemplateUsage(id);
    } catch (error) {
      logger.warn('Failed to increment usage count:', error);
    }
    navigate('/fill-form', { state: { templateId: id } });
  };

  const handleEdit = (id: string) => {
    navigate(`/templates/edit/${id}`);
  };

  const handlePreview = (id: string) => {
    setPreviewTemplateId(id);
    setIsPreviewOpen(true);
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    const template = templates.find((t) => t.id === id);
    setDeleteTemplateId(id);
    setDeleteTemplateName(template?.name || 'this template');
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deleteTemplateId) {
      deleteMutation.mutate(deleteTemplateId);
    }
  };

  const handleCreateTemplate = () => {
    navigate('/templates');
  };

  const handlePreviewUseTemplate = async (id: string) => {
    try {
      await incrementTemplateUsage(id);
    } catch (error) {
      logger.warn('Failed to increment usage count:', error);
    }
    navigate('/fill-form', { state: { templateId: id } });
  };

  const hasActiveFilters = selectedCategory !== 'all' || searchQuery.trim() !== '';

  const clearFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
  };

  // Header actions
  const headerActions = (
    <Button
      onClick={handleCreateTemplate}
      className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
      data-testid="create-template-button"
    >
      <Plus className="h-4 w-4 mr-2" />
      Create Template
    </Button>
  );

  // Loading skeletons
  const renderSkeletons = () => (
    <ResponsiveGrid preset="cards">
      {Array.from({ length: 6 }).map((_, index) => (
        <TemplateCardSkeleton key={index} viewMode={viewMode} />
      ))}
    </ResponsiveGrid>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto" data-testid="template-library">
      {/* Page Header */}
      <PageHeader
        title="Templates"
        description="Browse and manage your form templates for quick document filling."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Template Library' }]}
        actions={headerActions}
      />

      {/* Toolbar: Search, Filters, View Mode Toggle */}
      <div className="glass-panel p-4 rounded-xl flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 focus:bg-background transition-all"
              data-testid="template-search"
            />
          </div>

          {/* Category Filter */}
          <Select
            value={selectedCategory}
            onValueChange={(value) => setSelectedCategory(value as TemplateCategory)}
          >
            <SelectTrigger className="w-40" data-testid="category-filter">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort By */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
            <SelectTrigger className="w-36" data-testid="sort-by">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-muted/20 p-1 rounded-lg border border-white/5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'grid'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            data-testid="view-mode-grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2 rounded-md transition-all',
              viewMode === 'list'
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            data-testid="view-mode-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Template Content */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div data-testid="loading-state">{renderSkeletons()}</div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-10"
            data-testid="error-state"
          >
            <EmptyState
              icon={LayoutTemplate}
              title="Failed to load templates"
              description="There was an error loading your templates. Please try again."
              action={{
                label: 'Retry',
                onClick: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
                variant: 'default',
              }}
            />
          </motion.div>
        ) : filteredTemplates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-10"
            data-testid="empty-state"
          >
            <EmptyState
              icon={hasActiveFilters ? Search : LayoutTemplate}
              title={hasActiveFilters ? 'No templates match your filters' : 'No templates yet'}
              description={
                hasActiveFilters
                  ? 'Try adjusting your search or category filter'
                  : 'Create your first template to start automating form filling.'
              }
              action={
                hasActiveFilters
                  ? {
                      label: 'Clear Filters',
                      onClick: clearFilters,
                      variant: 'outline',
                    }
                  : {
                      label: 'Create Template',
                      onClick: handleCreateTemplate,
                      icon: Plus,
                    }
              }
            />
          </motion.div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <motion.div
            key="grid"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            data-testid="template-grid"
          >
            <ResponsiveGrid preset="cards">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  viewMode="grid"
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onPreview={handlePreview}
                  onUse={handleTemplateClick}
                  onClick={handleTemplateClick}
                />
              ))}
            </ResponsiveGrid>
          </motion.div>
        ) : (
          /* List View */
          <motion.div
            key="list"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="bg-card/30 backdrop-blur-sm border border-white/5 rounded-xl overflow-hidden"
            data-testid="template-list"
          >
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                viewMode="list"
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onPreview={handlePreview}
                onUse={handleTemplateClick}
                onClick={handleTemplateClick}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Count */}
      {!isLoading && !error && filteredTemplates.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {filteredTemplates.length} template
          {filteredTemplates.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </div>
      )}

      {/* Preview Modal */}
      <TemplatePreviewModal
        templateId={previewTemplateId}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        onEdit={handleEdit}
        onUseTemplate={handlePreviewUseTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTemplateName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
