import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Share2, Mail, Copy, Check, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  shareDocument,
  type ShareDocumentRequest,
  type SharePermission,
} from '@/services/documentService';

// Validation schema
const shareSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  permission: z.enum(['VIEW', 'COMMENT', 'EDIT'] as const),
  expiresIn: z.number().min(1).max(720), // 1 hour to 30 days (720 hours)
});

type ShareFormData = z.infer<typeof shareSchema>;

interface ShareDocumentModalProps {
  documentId: string;
  documentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShareCreated?: () => void;
}

const permissionOptions: { value: SharePermission; label: string; description: string }[] = [
  { value: 'VIEW', label: 'View Only', description: 'Can view the document' },
  { value: 'COMMENT', label: 'Comment', description: 'Can view and add comments' },
  { value: 'EDIT', label: 'Edit', description: 'Can view, comment, and edit' },
];

const expiryOptions = [
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '7 days' },
  { value: 336, label: '14 days' },
  { value: 720, label: '30 days' },
];

/**
 * Modal for sharing a document with another user via email.
 * Creates a shareable link with configurable permissions and expiry.
 */
export function ShareDocumentModal({
  documentId,
  documentName,
  open,
  onOpenChange,
  onShareCreated,
}: ShareDocumentModalProps): React.ReactElement {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ShareFormData>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      email: '',
      permission: 'VIEW',
      expiresIn: 168, // 7 days default
    },
  });

  const selectedPermission = watch('permission');
  const selectedExpiry = watch('expiresIn');

  const shareMutation = useMutation({
    mutationFn: (data: ShareDocumentRequest) => shareDocument(documentId, data),
    onSuccess: (response) => {
      if (response.share?.shareUrl) {
        // Build full URL
        const fullUrl = `${window.location.origin}${response.share.shareUrl}`;
        setShareUrl(fullUrl);
        toast.success('Share link created successfully');
        onShareCreated?.();
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create share link');
      toast.error(err.message || 'Failed to create share link');
    },
  });

  function handleClose(): void {
    reset();
    setShareUrl(null);
    setCopied(false);
    setError(null);
    onOpenChange(false);
  }

  function handleCopyLink(): void {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleShareAnother(): void {
    setShareUrl(null);
    setCopied(false);
    setError(null);
    reset();
  }

  function onSubmit(data: ShareFormData): void {
    setError(null);
    shareMutation.mutate({
      email: data.email,
      permission: data.permission,
      expiresIn: data.expiresIn,
      generateLink: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm" data-testid="share-document-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            {documentName
              ? `Share "${documentName}" with someone via email.`
              : 'Create a shareable link for this document.'}
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          // Share link created - show link view
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <LinkIcon className="h-4 w-4 text-primary" />
                Share Link Created
              </div>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-xs"
                  data-testid="share-link-input"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  data-testid="copy-link-button"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with the recipient. They will receive access based on the
                permissions you selected.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={handleShareAnother}
                data-testid="share-another-button"
              >
                Share with someone else
              </Button>
              <Button onClick={handleClose} data-testid="done-button">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // Share form
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email">Recipient Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  className="pl-9"
                  {...register('email')}
                  disabled={shareMutation.isPending}
                  aria-invalid={!!errors.email}
                  data-testid="share-email-input"
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {/* Permission Select */}
            <div className="space-y-2">
              <Label htmlFor="permission">Permission Level</Label>
              <Select
                value={selectedPermission}
                onValueChange={(value) => setValue('permission', value as SharePermission)}
                disabled={shareMutation.isPending}
              >
                <SelectTrigger id="permission" data-testid="share-permission-select">
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  {permissionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Expiry Select */}
            <div className="space-y-2">
              <Label htmlFor="expiresIn">Link Expiry</Label>
              <Select
                value={String(selectedExpiry)}
                onValueChange={(value) => setValue('expiresIn', Number(value))}
                disabled={shareMutation.isPending}
              >
                <SelectTrigger id="expiresIn" data-testid="share-expiry-select">
                  <SelectValue placeholder="Select expiry" />
                </SelectTrigger>
                <SelectContent>
                  {expiryOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={shareMutation.isPending}
                data-testid="share-cancel-button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={shareMutation.isPending}
                data-testid="share-submit-button"
              >
                {shareMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Create Share Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ShareDocumentModal;
