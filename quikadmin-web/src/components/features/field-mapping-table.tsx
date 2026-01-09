/**
 * Field Mapping Table Component
 *
 * Displays form fields and allows mapping to document data fields.
 * Features:
 * - Shows form field name, type, and required status
 * - Dropdown to select document field
 * - Per-field confidence badge with color coding (high/medium/low)
 * - Extraction source indicator (OCR/Pattern/LLM)
 * - Tooltip with confidence %, source, and raw text
 * - Visual indicator for low-confidence fields requiring review
 * - Reset to auto-mapping button
 * - Warning for unmapped required fields
 * - Backward compatibility for old simple value format
 */

import { AlertCircle, RotateCcw, AlertTriangle, Scan, Regex, Sparkles, Info } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FormField, DocumentData, FieldMapping, ExtractedFieldResult, ExtractionSource } from '@/types/formFilling';
import { isExtractedFieldResult } from '@/types/formFilling';
import { getConfidenceBadgeVariant, getConfidenceLevel, getSourceLabel } from '@/utils/fieldMapping';
import { cn } from '@/lib/utils';

/**
 * Extended field sources with extraction metadata
 */
interface FieldSourceInfo {
  documentId: string;
  fileName: string;
  confidence: number | null;
}

/**
 * Per-field extraction result that can be provided for each document field
 */
interface PerFieldExtractionInfo {
  confidence: number;
  source: ExtractionSource;
  rawText?: string;
}

interface FieldMappingTableProps {
  formFields: FormField[];
  documentData: DocumentData;
  mappings: FieldMapping[];
  onMappingChange: (formField: string, documentField: string | null) => void;
  onResetMapping: (formField: string) => void;
  /** Legacy field sources for document origin */
  fieldSources?: Record<string, FieldSourceInfo[]>;
  /** New per-field extraction info with confidence and source */
  fieldExtractionInfo?: Record<string, PerFieldExtractionInfo>;
}

/**
 * Source icon component based on extraction method
 */
function SourceIcon({ source, className }: { source: ExtractionSource; className?: string }) {
  switch (source) {
    case 'ocr':
      return <Scan className={cn('h-3 w-3', className)} />;
    case 'pattern':
      return <Regex className={cn('h-3 w-3', className)} />;
    case 'llm':
      return <Sparkles className={cn('h-3 w-3', className)} />;
    default:
      return <Info className={cn('h-3 w-3', className)} />;
  }
}

/**
 * Confidence indicator with tooltip showing details
 */
function ConfidenceIndicator({
  confidence,
  source,
  rawText,
  showWarning = false,
}: {
  confidence: number;
  source?: ExtractionSource;
  rawText?: string;
  showWarning?: boolean;
}) {
  const levelConfig = getConfidenceLevel(confidence);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5">
            <Badge
              variant={levelConfig.badgeVariant}
              className="font-mono text-xs gap-1"
            >
              {source && <SourceIcon source={source} />}
              {confidence}%
            </Badge>
            {showWarning && levelConfig.requiresReview && (
              <AlertTriangle className="h-4 w-4 text-warning animate-pulse" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Confidence:</span>
              <span className="font-mono font-medium">{confidence}%</span>
            </div>
            {source && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Source:</span>
                <span className="flex items-center gap-1">
                  <SourceIcon source={source} />
                  {getSourceLabel(source)}
                </span>
              </div>
            )}
            {rawText && (
              <div className="pt-1 border-t border-border/50">
                <span className="text-muted-foreground text-xs">Raw text:</span>
                <p className="font-mono text-xs mt-0.5 bg-muted/50 px-1.5 py-1 rounded break-all">
                  {rawText}
                </p>
              </div>
            )}
            {levelConfig.requiresReview && (
              <div className="pt-1 border-t border-border/50 flex items-center gap-1.5 text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs">Low confidence - review recommended</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FieldMappingTable({
  formFields,
  documentData,
  mappings,
  onMappingChange,
  onResetMapping,
  fieldSources,
  fieldExtractionInfo,
}: FieldMappingTableProps) {
  // Get field names from either new format (fields property) or old format (direct keys)
  const documentFieldNames = Object.keys(documentData.fields || documentData);

  const getMapping = (formFieldName: string): FieldMapping | undefined => {
    return mappings.find((m) => m.formField === formFieldName);
  };

  const getMappingValue = (formFieldName: string): string => {
    const mapping = getMapping(formFieldName);
    return mapping?.documentField || 'unmapped';
  };

  const getConfidence = (formFieldName: string): number => {
    const mapping = getMapping(formFieldName);
    return mapping?.confidence || 0;
  };

  const isManualOverride = (formFieldName: string): boolean => {
    const mapping = getMapping(formFieldName);
    return mapping?.manualOverride || false;
  };

  const getFieldSource = (documentField: string | null): string => {
    if (!documentField || !fieldSources || !fieldSources[documentField]) {
      return '';
    }
    const sources = fieldSources[documentField];
    if (sources.length === 0) return '';
    if (sources.length === 1) return sources[0].fileName;
    return `${sources[0].fileName} +${sources.length - 1} more`;
  };

  /**
   * Get per-field extraction info from multiple sources:
   * 1. New fieldExtractionInfo prop (priority)
   * 2. ExtractedFieldResult in documentData.fields
   * 3. Fall back to mapping confidence (legacy)
   */
  const getFieldExtractionDetails = (
    documentField: string | null
  ): { confidence: number; source?: ExtractionSource; rawText?: string } | null => {
    if (!documentField) return null;

    // Priority 1: Check fieldExtractionInfo prop
    if (fieldExtractionInfo && fieldExtractionInfo[documentField]) {
      return fieldExtractionInfo[documentField];
    }

    // Priority 2: Check if documentData.fields has ExtractedFieldResult
    const fieldsObj = documentData.fields || documentData;
    const fieldValue = fieldsObj[documentField];

    if (isExtractedFieldResult(fieldValue)) {
      return {
        confidence: fieldValue.confidence,
        source: fieldValue.source,
        rawText: fieldValue.rawText,
      };
    }

    // Priority 3: Fall back to mapping confidence (legacy format)
    return null;
  };

  /**
   * Check if any mapped field has low confidence requiring review
   */
  const hasLowConfidenceFields = mappings.some((m) => {
    if (!m.documentField) return false;
    const details = getFieldExtractionDetails(m.documentField);
    if (details) {
      return getConfidenceLevel(details.confidence).requiresReview;
    }
    return getConfidenceLevel(m.confidence || 0).requiresReview;
  });

  /**
   * Get row background class based on confidence level
   */
  const getRowBgClass = (documentField: string | null, mappingConfidence: number): string => {
    if (!documentField) return '';
    const details = getFieldExtractionDetails(documentField);
    const confidence = details?.confidence ?? mappingConfidence;
    return getConfidenceLevel(confidence).rowBgClass;
  };

  return (
    <div className="rounded-md border">
      {/* Low confidence warning banner */}
      {hasLowConfidenceFields && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/10 border-b border-warning/20 text-sm text-warning-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span>Some fields have low confidence and may need review</span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">Form Field</TableHead>
            <TableHead className="w-[12%]">Type</TableHead>
            <TableHead className="w-[28%]">Document Field</TableHead>
            <TableHead className="w-[20%]">Source</TableHead>
            <TableHead className="w-[10%]">Confidence</TableHead>
            <TableHead className="w-[5%]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formFields.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No form fields detected. Please upload a valid form.
              </TableCell>
            </TableRow>
          ) : (
            formFields.map((field) => {
              const mappingValue = getMappingValue(field.name);
              const mappingConfidence = getConfidence(field.name);
              const isUnmapped = mappingValue === 'unmapped';
              const showRequiredWarning = field.required && isUnmapped;
              const isManual = isManualOverride(field.name);
              const source = getFieldSource(mappingValue === 'unmapped' ? null : mappingValue);

              // Get per-field extraction details (new format) or fall back to mapping confidence
              const extractionDetails = getFieldExtractionDetails(
                isUnmapped ? null : mappingValue
              );
              const effectiveConfidence = extractionDetails?.confidence ?? mappingConfidence;
              const extractionSource = extractionDetails?.source;
              const rawText = extractionDetails?.rawText;
              const rowBgClass = getRowBgClass(
                isUnmapped ? null : mappingValue,
                mappingConfidence
              );

              return (
                <TableRow key={field.name} className={cn(rowBgClass)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.name}</span>
                      {field.required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {showRequiredWarning && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Required field must be mapped</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-muted-foreground capitalize">
                      {field.type}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={mappingValue}
                      onValueChange={(value) => {
                        const newValue = value === 'unmapped' ? null : value;
                        onMappingChange(field.name, newValue);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select document field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unmapped">
                          <span className="text-muted-foreground italic">
                            -- Unmapped --
                          </span>
                        </SelectItem>
                        {documentFieldNames.map((docField) => (
                          <SelectItem key={docField} value={docField}>
                            {docField}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>
                    {!isUnmapped && source && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs truncate max-w-[150px]">
                              {source}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Data source: {source}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>

                  <TableCell>
                    {!isUnmapped && (
                      <div className="flex items-center gap-2">
                        {/* Use new ConfidenceIndicator for per-field confidence display */}
                        <ConfidenceIndicator
                          confidence={effectiveConfidence}
                          source={extractionSource}
                          rawText={rawText}
                          showWarning={true}
                        />
                        {isManual && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs">
                                  Manual
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Manually overridden mapping</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {isManual && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onResetMapping(field.name)}
                              className="h-8 w-8 p-0"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reset to auto-mapping</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
