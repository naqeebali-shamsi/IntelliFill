import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, UserPlus, Loader2 } from 'lucide-react';

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
  inviteMember,
  type OrganizationRole,
} from '@/services/organizationService';

// Validation schema
const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'] as const, {
    required_error: 'Please select a role',
  }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserRole: OrganizationRole;
  onInviteSent?: () => void;
}

/**
 * Modal for inviting new members to an organization.
 * Available roles depend on the current user's role:
 * - OWNER: Can invite ADMIN, MEMBER, VIEWER
 * - ADMIN: Can invite MEMBER, VIEWER only
 */
export function InviteMemberModal({
  open,
  onOpenChange,
  organizationId,
  currentUserRole,
  onInviteSent,
}: InviteMemberModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'MEMBER',
    },
  });

  const selectedRole = watch('role');

  // Determine available roles based on current user's role
  const availableRoles: { value: OrganizationRole; label: string; description: string }[] =
    currentUserRole === 'OWNER'
      ? [
          { value: 'ADMIN', label: 'Admin', description: 'Can manage members and settings' },
          { value: 'MEMBER', label: 'Member', description: 'Can view and edit documents' },
          { value: 'VIEWER', label: 'Viewer', description: 'Can only view documents' },
        ]
      : [
          { value: 'MEMBER', label: 'Member', description: 'Can view and edit documents' },
          { value: 'VIEWER', label: 'Viewer', description: 'Can only view documents' },
        ];

  const handleClose = () => {
    reset();
    setError(null);
    setSuccess(false);
    onOpenChange(false);
  };

  const onSubmit = async (data: InviteFormData) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await inviteMember(organizationId, {
        email: data.email,
        role: data.role as OrganizationRole,
      });
      setSuccess(true);
      onInviteSent?.();

      // Close modal after short delay to show success
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm" data-testid="invite-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to add a new member to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                className="pl-9"
                {...register('email')}
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                data-testid="invite-email-input"
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Role Select */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as InviteFormData['role'])}
              disabled={isSubmitting}
            >
              <SelectTrigger id="role" data-testid="invite-role-select">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{role.label}</span>
                      <span className="text-xs text-muted-foreground">{role.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="bg-success/10 border-success/20 text-success-foreground">
              <AlertDescription>Invitation sent successfully!</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              data-testid="invite-cancel-button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="invite-submit-button">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default InviteMemberModal;
