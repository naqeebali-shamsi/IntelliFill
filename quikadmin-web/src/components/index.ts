/**
 * Component Library Index
 * Central export file for all QuikAdmin components
 *
 * Usage:
 * import { Button, Card, Skeleton, PageHeader, DocumentCard } from '@/components'
 */

// ============================================================================
// UI Components (Base)
// ============================================================================

// Button
export { Button, buttonVariants } from './ui/button';

// Card
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from './ui/card';

// Input & Forms
export { Input } from './ui/input';
export { Label } from './ui/label';
export { Textarea } from './ui/textarea';
export { Checkbox } from './ui/checkbox';
export { RadioGroup, RadioGroupItem } from './ui/radio-group';
export { Switch } from './ui/switch';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select';

// Sleek Design System Components
export {
  SleekIconButton,
  sleekIconButtonVariants,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from './ui/sleek-icon-button';
export type { SleekIconButtonProps } from './ui/sleek-icon-button';

export { AccentLine, accentLineVariants, ProgressLine, SeparatorLine } from './ui/accent-line';
export type { AccentLineProps, ProgressLineProps, SeparatorLineProps } from './ui/accent-line';

export { SleekBadge, sleekBadgeVariants, AnimatedSleekBadge, SleekLabel } from './ui/sleek-badge';
export type { SleekBadgeProps, AnimatedSleekBadgeProps, SleekLabelProps } from './ui/sleek-badge';

export {
  SleekTooltip,
  SleekTooltipContent,
  SleekTooltipTrigger,
  SleekIconBar,
  sleekTooltipVariants,
  useSleekTooltip,
} from './ui/sleek-tooltip';
export type {
  SleekTooltipProps,
  SleekTooltipTriggerProps,
  SleekTooltipCompleteProps,
  SleekIconBarProps,
  SleekIconBarItem,
} from './ui/sleek-tooltip';

export { AnimatedLogo } from './ui/animated-logo';
export type { AnimatedLogoProps } from './ui/animated-logo';

// Feedback Components
export { Alert, AlertTitle, AlertDescription } from './ui/alert';
export {
  Progress,
  ProgressCircular,
  progressVariants,
  progressIndicatorVariants,
} from './ui/progress';
export type { ProgressProps, ProgressCircularProps } from './ui/progress';
export { Badge } from './ui/badge';

// Loading Components
export { Skeleton, SkeletonText, skeletonVariants } from './ui/skeleton';
export type { SkeletonProps, SkeletonTextProps } from './ui/skeleton';
export { Spinner, SpinnerOverlay, spinnerVariants } from './ui/spinner';
export type { SpinnerProps, SpinnerOverlayProps } from './ui/spinner';
export {
  LoadingState,
  LoadingStateSkeleton,
  LoadingStateSpinner,
  LoadingStateOverlay,
  loadingStateVariants,
} from './ui/loading-state';
export type { LoadingStateProps } from './ui/loading-state';

// Empty States
export { EmptyState, EmptyStateSimple, emptyStateVariants } from './ui/empty-state';
export type { EmptyStateProps, EmptyStateSimpleProps } from './ui/empty-state';

// Navigation
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './ui/breadcrumb';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

// Overlays
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
export { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Dropdown & Menu
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

// Table
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

// Misc
export { ScrollArea } from './ui/scroll-area';
export { Separator } from './ui/separator';
export { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

// Charts
export { MiniChart } from './ui/mini-chart';
export type { MiniChartProps, MiniChartDataPoint } from './ui/mini-chart';

// ============================================================================
// Layout Components
// ============================================================================

export { PageHeader, PageHeaderSkeleton } from './layout/page-header';
export type {
  PageHeaderProps,
  PageHeaderBreadcrumb,
  PageHeaderSkeletonProps,
} from './layout/page-header';

export {
  ContentContainer,
  ContentSection,
  contentContainerVariants,
} from './layout/content-container';
export type { ContentContainerProps, ContentSectionProps } from './layout/content-container';

export { ResponsiveGrid, GridItem, gridVariants } from './layout/responsive-grid';
export type { ResponsiveGridProps, GridItemProps } from './layout/responsive-grid';

export { Section, SectionDivider, SectionGrid, sectionVariants } from './layout/section';
export type { SectionProps, SectionDividerProps, SectionGridProps } from './layout/section';

// ============================================================================
// Feature Components
// ============================================================================

// Statistics
export { StatCard } from './features/stat-card';
export type { StatCardProps } from './features/stat-card';

// Status Indicators
export { StatusBadge, StatusDot, statusBadgeVariants } from './features/status-badge';
export type { StatusBadgeProps, StatusDotProps } from './features/status-badge';

// File Upload
export { FileUploadZone, FileUploadButton } from './features/file-upload-zone';
export type { FileUploadZoneProps, FileUploadButtonProps } from './features/file-upload-zone';

// Document Card
export { DocumentCard, DocumentCardSkeleton } from './features/document-card';
export type {
  DocumentCardProps,
  DocumentCardSkeletonProps,
  DocumentFileType,
  DocumentStatus,
} from './features/document-card';

// Search Bar
export { SearchBar, SearchBarWithResults } from './features/search-bar';
export type { SearchBarProps, SearchBarWithResultsProps } from './features/search-bar';

// Data Table
export { DataTable } from './features/data-table';
export type { DataTableProps, Column } from './features/data-table';

// Processing Status
export { ProcessingStatus, ProcessingStatusList } from './features/processing-status';
export type {
  ProcessingStatusProps,
  ProcessingStatusListProps,
  ProcessingStatusType,
} from './features/processing-status';

// ============================================================================
// Special Components
// ============================================================================

// Theme
export { ThemeProvider, useTheme } from './theme-provider';
export { ModeToggle } from './mode-toggle';

// Layout

// Auth
export { ProtectedRoute } from './ProtectedRoute';
export { PasswordVisibilityToggle } from './auth/PasswordVisibilityToggle';
export type { PasswordVisibilityToggleProps } from './auth/PasswordVisibilityToggle';
export { AttemptsWarning } from './auth/AttemptsWarning';
export type { AttemptsWarningProps } from './auth/AttemptsWarning';

// Error Boundary
export type { ErrorBoundaryProps, ErrorBoundaryState } from './ErrorBoundary';

// Toast (Sonner)
export { Toaster } from './ui/sonner';
