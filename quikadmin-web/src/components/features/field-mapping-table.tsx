/**
 * Field Mapping Table Component
 *
 * Displays form fields and allows mapping to document data fields.
 * Features:
 * - Shows form field name, type, and required status
 * - Dropdown to select document field
 * - Confidence badge with color coding
 * - Reset to auto-mapping button
 * - Warning for unmapped required fields
 */

import { AlertCircle, RotateCcw } from 'lucide-react';
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
import type { FormField, DocumentData, FieldMapping } from '@/types/formFilling';
import { getConfidenceBadgeVariant } from '@/utils/fieldMapping';

interface FieldMappingTableProps {
  formFields: FormField[];
  documentData: DocumentData;
  mappings: FieldMapping[];
  onMappingChange: (formField: string, documentField: string | null) => void;
  onResetMapping: (formField: string) => void;
  fieldSources?: Record<string, Array<{ documentId: string; fileName: string; confidence: number | null }>>;
}

export function FieldMappingTable({
  formFields,
  documentData,
  mappings,
  onMappingChange,
  onResetMapping,
  fieldSources,
}: FieldMappingTableProps) {
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

  return (
    <div className="rounded-md border">
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
              const confidence = getConfidence(field.name);
              const isUnmapped = mappingValue === 'unmapped';
              const showWarning = field.required && isUnmapped;
              const isManual = isManualOverride(field.name);
              const source = getFieldSource(mappingValue === 'unmapped' ? null : mappingValue);

              return (
                <TableRow key={field.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{field.name}</span>
                      {field.required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {showWarning && (
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
                        <Badge
                          variant={getConfidenceBadgeVariant(confidence)}
                          className="font-mono"
                        >
                          {confidence}%
                        </Badge>
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
