import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  UserPlus,
  Settings,
  Loader2,
  LogOut,
  Trash2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { useBackendAuthStore } from '@/stores/backendAuthStore';
import {
  getMyOrganization,
  getOrganizationMembers,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  leaveOrganization,
  type Organization,
  type OrganizationMember,
  type OrganizationRole,
} from '@/services/organizationService';
import { MembersList } from './MembersList';
import { InviteMemberModal } from './InviteMemberModal';

// Section wrapper component (matching Settings page pattern)
const SettingsSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-4 mb-8">
    <div>
      <h3 className="text-lg font-medium tracking-tight text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    <div className="space-y-4 pl-1">{children}</div>
  </div>
);

// Row wrapper component (matching Settings page pattern)
const SettingsRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors',
      className
    )}
  >
    {children}
  </div>
);

/**
 * Organization tab content for the Settings page.
 * Displays organization info, members list, and management actions.
 */
export function OrganizationTabContent() {
  const user = useBackendAuthStore((state) => state.user);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create organization state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit organization state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Leave/Delete confirmation state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get current user's role in the organization
  const currentUserMembership = members.find((m) => m.userId === user?.id);
  const currentUserRole: OrganizationRole = currentUserMembership?.role || 'VIEWER';
  const isOwner = currentUserRole === 'OWNER';
  const isAdmin = currentUserRole === 'ADMIN';
  const canManage = isOwner || isAdmin;

  // Load organization data
  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const org = await getMyOrganization();
      setOrganization(org);

      if (org) {
        const membersList = await getOrganizationMembers(org.id);
        setMembers(membersList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  // Create new organization
  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    setIsCreating(true);
    try {
      const org = await createOrganization({ name: newOrgName.trim() });
      setOrganization(org);
      setShowCreateForm(false);
      setNewOrgName('');
      await loadOrganization();
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setIsCreating(false);
    }
  };

  // Update organization name
  const handleSaveOrganization = async () => {
    if (!organization || !editedName.trim()) return;

    setIsSaving(true);
    try {
      const updated = await updateOrganization(organization.id, { name: editedName.trim() });
      setOrganization(updated);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update organization');
    } finally {
      setIsSaving(false);
    }
  };

  // Leave organization
  const handleLeaveOrganization = async () => {
    if (!organization) return;

    setIsLeaving(true);
    try {
      await leaveOrganization(organization.id);
      setOrganization(null);
      setMembers([]);
      setShowLeaveDialog(false);
    } catch (err: any) {
      setError(err.message || 'Failed to leave organization');
    } finally {
      setIsLeaving(false);
    }
  };

  // Delete organization
  const handleDeleteOrganization = async () => {
    if (!organization) return;

    setIsDeleting(true);
    try {
      await deleteOrganization(organization.id);
      setOrganization(null);
      setMembers([]);
      setShowDeleteDialog(false);
    } catch (err: any) {
      setError(err.message || 'Failed to delete organization');
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Empty state - no organization
  if (!organization) {
    return (
      <div className="space-y-6">
        {!showCreateForm ? (
          <EmptyState
            icon={Building2}
            title="No Organization"
            description="You're not part of any organization yet. Create one to collaborate with your team."
            action={{
              label: 'Create Organization',
              onClick: () => setShowCreateForm(true),
              icon: Building2,
            }}
          />
        ) : (
          <div className="max-w-md mx-auto space-y-4 p-6 rounded-lg border bg-card" data-testid="org-create-form">
            <div>
              <h3 className="text-lg font-semibold">Create Organization</h3>
              <p className="text-sm text-muted-foreground">
                Give your organization a name to get started.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Acme Inc."
                disabled={isCreating}
                data-testid="org-name-input"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewOrgName('');
                }}
                disabled={isCreating}
                data-testid="org-cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrganization}
                disabled={!newOrgName.trim() || isCreating}
                data-testid="org-create-button"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Organization exists - show full content
  return (
    <div className="space-y-6">
      {/* Organization Summary */}
      <SettingsSection
        title="Organization Details"
        description="View and manage your organization settings."
      >
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20" data-testid="org-details-section">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="h-8 w-48"
                      disabled={isSaving}
                      data-testid="org-name-input"
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveOrganization}
                      disabled={!editedName.trim() || isSaving}
                      data-testid="org-save-button"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setEditedName(organization.name);
                      }}
                      disabled={isSaving}
                      data-testid="org-cancel-button"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-lg" data-testid="org-name-display">{organization.name}</h4>
                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary">
                      {currentUserRole}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
            {canManage && !isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(true);
                  setEditedName(organization.name);
                }}
                data-testid="org-edit-button"
              >
                <Settings className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      <Separator className="bg-white/10" />

      {/* Members Section */}
      <SettingsSection
        title="Team Members"
        description="Manage who has access to your organization."
      >
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} in your organization
          </p>
          {canManage && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>

        <MembersList
          members={members}
          organizationId={organization.id}
          currentUserId={user?.id || ''}
          currentUserRole={currentUserRole}
          onMembersChanged={loadOrganization}
        />
      </SettingsSection>

      {/* Danger Zone */}
      <div className="mt-8 pt-8 border-t border-destructive/20">
        <h3 className="text-lg font-medium text-destructive mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" /> Danger Zone
        </h3>

        {!isOwner ? (
          // Non-owners can leave
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-medium text-destructive-foreground">Leave Organization</div>
              <p className="text-xs text-destructive-foreground/70">
                Remove yourself from this organization
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowLeaveDialog(true)}
              data-testid="org-leave-button"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Leave
            </Button>
          </div>
        ) : (
          // Owners can delete
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="font-medium text-destructive-foreground">Delete Organization</div>
              <p className="text-xs text-destructive-foreground/70">
                Permanently delete this organization and all data
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              data-testid="org-delete-button"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        organizationId={organization.id}
        currentUserRole={currentUserRole}
        onInviteSent={loadOrganization}
      />

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave{' '}
              <span className="font-medium text-foreground">{organization.name}</span>? You will
              lose access to all organization resources and will need to be re-invited to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrganization}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Leave Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <span className="font-medium text-foreground">{organization.name}</span> and remove
              all members. All organization data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrganization}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default OrganizationTabContent;
