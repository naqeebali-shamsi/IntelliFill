import { useState } from 'react';
import { MoreHorizontal, Shield, User, Eye, Crown, Loader2, UserMinus } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { cn } from '@/lib/utils';
import {
  changeMemberRole,
  removeMember,
  type OrganizationMember,
  type OrganizationRole,
} from '@/services/organizationService';

interface MembersListProps {
  members: OrganizationMember[];
  organizationId: string;
  currentUserId: string;
  currentUserRole: OrganizationRole;
  onMembersChanged?: () => void;
}

// Role configuration for display
const roleConfig: Record<
  OrganizationRole,
  { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'outline' }
> = {
  OWNER: { label: 'Owner', icon: <Crown className="h-3 w-3" />, variant: 'default' },
  ADMIN: { label: 'Admin', icon: <Shield className="h-3 w-3" />, variant: 'secondary' },
  MEMBER: { label: 'Member', icon: <User className="h-3 w-3" />, variant: 'outline' },
  VIEWER: { label: 'Viewer', icon: <Eye className="h-3 w-3" />, variant: 'outline' },
};

// Get initials from name
function getInitials(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// Get display name
function getDisplayName(firstName: string | null, lastName: string | null, email: string): string {
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  return email.split('@')[0];
}

/**
 * Component for displaying and managing organization members.
 * Supports role changes (for ADMIN+ users) and member removal.
 */
export function MembersList({
  members,
  organizationId,
  currentUserId,
  currentUserRole,
  onMembersChanged,
}: MembersListProps) {
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Check if current user can manage roles (OWNER or ADMIN)
  const canManageRoles = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';

  // Get roles that current user can assign
  const assignableRoles: OrganizationRole[] =
    currentUserRole === 'OWNER'
      ? ['ADMIN', 'MEMBER', 'VIEWER']
      : ['MEMBER', 'VIEWER'];

  // Check if user can change another member's role
  const canChangeRole = (member: OrganizationMember): boolean => {
    // Cannot change own role
    if (member.userId === currentUserId) return false;
    // Cannot change OWNER's role
    if (member.role === 'OWNER') return false;
    // ADMINs cannot change other ADMIN's roles
    if (currentUserRole === 'ADMIN' && member.role === 'ADMIN') return false;
    return canManageRoles;
  };

  // Check if user can remove another member
  const canRemoveMember = (member: OrganizationMember): boolean => {
    // Cannot remove self
    if (member.userId === currentUserId) return false;
    // Cannot remove OWNER
    if (member.role === 'OWNER') return false;
    // ADMINs cannot remove other ADMINs
    if (currentUserRole === 'ADMIN' && member.role === 'ADMIN') return false;
    return canManageRoles;
  };

  const handleRoleChange = async (member: OrganizationMember, newRole: OrganizationRole) => {
    if (newRole === member.role) return;

    setLoadingMemberId(member.userId);
    try {
      await changeMemberRole(organizationId, member.userId, newRole);
      onMembersChanged?.();
    } catch (error) {
      console.error('Failed to change role:', error);
    } finally {
      setLoadingMemberId(null);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    setIsRemoving(true);
    try {
      await removeMember(organizationId, memberToRemove.userId);
      onMembersChanged?.();
    } catch (error) {
      console.error('Failed to remove member:', error);
    } finally {
      setIsRemoving(false);
      setMemberToRemove(null);
    }
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border overflow-hidden" data-testid="members-list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[150px]">Role</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const { user } = member;
              const isCurrentUser = member.userId === currentUserId;
              const isLoading = loadingMemberId === member.userId;

              return (
                <TableRow key={member.id} data-testid={`member-row-${member.userId}`}>
                  {/* Member Info */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatarUrl || undefined} alt={user.email} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user.firstName, user.lastName, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {getDisplayName(user.firstName, user.lastName, user.email)}
                          {isCurrentUser && (
                            <span className="text-xs text-muted-foreground">(you)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Email */}
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>

                  {/* Role */}
                  <TableCell>
                    {canChangeRole(member) ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          handleRoleChange(member, value as OrganizationRole)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-[120px] h-8" data-testid="member-role-select">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              <div className="flex items-center gap-2">
                                {roleConfig[role].icon}
                                <span>{roleConfig[role].label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={roleConfig[member.role].variant} className="gap-1">
                        {roleConfig[member.role].icon}
                        {roleConfig[member.role].label}
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    {canRemoveMember(member) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setMemberToRemove(member)}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3" data-testid="members-list-mobile">
        {members.map((member) => {
          const { user } = member;
          const isCurrentUser = member.userId === currentUserId;
          const isLoading = loadingMemberId === member.userId;

          return (
            <div
              key={member.id}
              className={cn(
                'rounded-lg border bg-card p-4 space-y-3',
                isCurrentUser && 'border-primary/20 bg-primary/5'
              )}
              data-testid={`member-row-${member.userId}`}
            >
              {/* Header with Avatar and Name */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatarUrl || undefined} alt={user.email} />
                    <AvatarFallback>
                      {getInitials(user.firstName, user.lastName, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {getDisplayName(user.firstName, user.lastName, user.email)}
                      {isCurrentUser && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                  </div>
                </div>
                {canRemoveMember(member) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setMemberToRemove(member)}
                  >
                    <UserMinus className="h-4 w-4" />
                    <span className="sr-only">Remove member</span>
                  </Button>
                )}
              </div>

              {/* Role */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Role</span>
                {canChangeRole(member) ? (
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      handleRoleChange(member, value as OrganizationRole)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="w-[120px] h-8" data-testid="member-role-select">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            {roleConfig[role].icon}
                            <span>{roleConfig[role].label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={roleConfig[member.role].variant} className="gap-1">
                    {roleConfig[member.role].icon}
                    {roleConfig[member.role].label}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              <span className="font-medium text-foreground">
                {memberToRemove &&
                  getDisplayName(
                    memberToRemove.user.firstName,
                    memberToRemove.user.lastName,
                    memberToRemove.user.email
                  )}
              </span>{' '}
              from the organization? They will lose access to all organization resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default MembersList;
