import { useState } from 'react';
import { Eye, AlertCircle, CheckCircle, Loader2, Pencil, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FormField, FieldMapping } from '@/types/formFilling';

interface FormPreviewProps {
  formFields: FormField[];
  mappings: FieldMapping[];
  /** Profile/document data source for field values */
  profileData?: Record<string, any>;
  /** @deprecated Use profileData instead */
  documentData?: Record<string, any>;
  /** User-edited values that override profile data */
  editedValues?: Record<string, string>;
  /** Handler for inline value editing (enables edit mode when provided) */
  onValueChange?: (fieldName: string, value: string) => void;
  onDownload?: () => void;
  downloadUrl?: string;
  confidence?: number;
  filledFields?: number;
  totalFields?: number;
  warnings?: string[];
}

export function FormPreview({
  formFields,
  mappings,
  profileData,
  documentData,
  editedValues = {},
  onValueChange,
  onDownload,
  downloadUrl,
  confidence,
  filledFields,
  totalFields,
  warnings,
}: FormPreviewProps) {
  const [previewLoading, setPreviewLoading] = useState(false);

  // Use profileData if provided, otherwise fall back to documentData for backwards compatibility
  const dataSource = profileData ?? documentData ?? {};

  const getFieldValue = (formFieldName: string): string => {
    // Check for edited value first (user override)
    if (editedValues[formFieldName] !== undefined) {
      return editedValues[formFieldName];
    }

    const mapping = mappings.find((m) => m.formField === formFieldName);
    if (!mapping || !mapping.documentField) {
      return '—';
    }
    const value = dataSource[mapping.documentField];
    if (value === undefined || value === null) {
      return '—';
    }
    return String(value);
  };

  const isValueEdited = (formFieldName: string): boolean => {
    return editedValues[formFieldName] !== undefined;
  };

  const getFieldConfidence = (formFieldName: string): number => {
    const mapping = mappings.find((m) => m.formField === formFieldName);
    return mapping?.confidence || 0;
  };

  const isFieldMapped = (formFieldName: string): boolean => {
    const mapping = mappings.find((m) => m.formField === formFieldName);
    return !!mapping?.documentField;
  };

  const getConfidenceBadgeVariant = (confidence: number): 'default' | 'secondary' | 'outline' => {
    if (confidence >= 90) return 'default';
    if (confidence >= 70) return 'secondary';
    return 'outline';
  };

  const mappedCount = mappings.filter((m) => m.documentField).length;
  const completionPercentage = totalFields
    ? Math.round(((filledFields || mappedCount) / totalFields) * 100)
    : Math.round((mappedCount / formFields.length) * 100);

  const handlePreview = () => {
    if (!downloadUrl) return;
    setPreviewLoading(true);
    window.open(downloadUrl, '_blank');
    setPreviewLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Form Preview
            </CardTitle>
            <CardDescription>Review field mappings and values before downloading</CardDescription>
          </div>
          {downloadUrl && (
            <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview PDF
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Fields Mapped</p>
            <p className="text-2xl font-bold">{filledFields || mappedCount}</p>
            <p className="text-xs text-muted-foreground">of {totalFields || formFields.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Completion</p>
            <p className="text-2xl font-bold">{completionPercentage}%</p>
            <Progress value={completionPercentage} className="h-2 mt-1" />
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-2xl font-bold">
              {confidence ? `${(confidence * 100).toFixed(0)}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Average match</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <div className="flex items-center gap-2 mt-1">
              {completionPercentage === 100 ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Complete
                </Badge>
              ) : (
                <Badge variant="secondary">{completionPercentage}% Complete</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warnings:</strong>
              <ul className="list-disc list-inside mt-1 text-sm">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Field Values Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Form Field</TableHead>
                <TableHead className="w-[30%]">Mapped To</TableHead>
                <TableHead className="w-[30%]">Value</TableHead>
                <TableHead className="w-[15%]">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formFields.map((field) => {
                const mapped = isFieldMapped(field.name);
                const value = getFieldValue(field.name);
                const fieldConfidence = getFieldConfidence(field.name);
                const mapping = mappings.find((m) => m.formField === field.name);

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
                      </div>
                    </TableCell>
                    <TableCell>
                      {mapped ? (
                        <span className="text-sm text-muted-foreground">
                          {mapping?.documentField}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Unmapped</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {onValueChange ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={value === '—' ? '' : value}
                            onChange={(e) => onValueChange(field.name, e.target.value)}
                            placeholder="Enter value..."
                            className="h-8 text-sm"
                          />
                          {isValueEdited(field.name) && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              <Pencil className="h-3 w-3 mr-1" />
                              Edited
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <div className="max-w-xs truncate" title={value}>
                          {mapped ? (
                            <span className="text-sm">{value}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground italic">—</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {mapped && fieldConfidence > 0 ? (
                        <Badge variant={getConfidenceBadgeVariant(fieldConfidence)}>
                          {fieldConfidence}%
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {onDownload && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button onClick={onDownload} disabled={!downloadUrl} className="min-w-[120px]">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
