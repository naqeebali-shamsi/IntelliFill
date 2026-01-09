import api from './api';
import { logger } from '@/utils/logger';

/**
 * Organization role types
 */
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

/**
 * Organization member interface
 */
export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
  };
}

/**
 * Organization interface
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

/**
 * Invitation interface
 */
export interface OrganizationInvitation {
  id: string;
  email: string;
  role: OrganizationRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  invitedById: string;
}

/**
 * Create organization request
 */
export interface CreateOrganizationRequest {
  name: string;
}

/**
 * Update organization request
 */
export interface UpdateOrganizationRequest {
  name?: string;
}

/**
 * Invite member request
 */
export interface InviteMemberRequest {
  email: string;
  role: OrganizationRole;
}

/**
 * Organization response wrapper
 */
interface OrganizationResponse {
  success: boolean;
  organization: Organization;
  message?: string;
}

/**
 * Members list response wrapper
 */
interface MembersResponse {
  success: boolean;
  members: OrganizationMember[];
  total: number;
}

/**
 * Member response wrapper
 */
interface MemberResponse {
  success: boolean;
  member: OrganizationMember;
  message?: string;
}

/**
 * Invitation response wrapper
 */
interface InvitationResponse {
  success: boolean;
  invitation: OrganizationInvitation;
  message?: string;
}

/**
 * Create a new organization
 */
export const createOrganization = async (
  data: CreateOrganizationRequest
): Promise<Organization> => {
  try {
    const response = await api.post<OrganizationResponse>('/organizations', data);
    return response.data.organization;
  } catch (error: any) {
    logger.error('Failed to create organization:', error);
    throw new Error(error.response?.data?.message || 'Failed to create organization');
  }
};

/**
 * Get current user's organization
 */
export const getMyOrganization = async (): Promise<Organization | null> => {
  try {
    const response = await api.get<OrganizationResponse>('/organizations/me');
    return response.data.organization;
  } catch (error: any) {
    // 404 means user doesn't have an organization - not an error
    if (error.response?.status === 404) {
      return null;
    }
    logger.error('Failed to fetch organization:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch organization');
  }
};

/**
 * Update organization details
 */
export const updateOrganization = async (
  organizationId: string,
  data: UpdateOrganizationRequest
): Promise<Organization> => {
  try {
    const response = await api.patch<OrganizationResponse>(
      `/organizations/${organizationId}`,
      data
    );
    return response.data.organization;
  } catch (error: any) {
    logger.error('Failed to update organization:', error);
    throw new Error(error.response?.data?.message || 'Failed to update organization');
  }
};

/**
 * Delete organization
 */
export const deleteOrganization = async (organizationId: string): Promise<void> => {
  try {
    await api.delete(`/organizations/${organizationId}`);
  } catch (error: any) {
    logger.error('Failed to delete organization:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete organization');
  }
};

/**
 * Get organization members
 */
export const getOrganizationMembers = async (
  organizationId: string
): Promise<OrganizationMember[]> => {
  try {
    const response = await api.get<MembersResponse>(
      `/organizations/${organizationId}/members`
    );
    return response.data.members;
  } catch (error: any) {
    logger.error('Failed to fetch organization members:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch members');
  }
};

/**
 * Change member role
 */
export const changeMemberRole = async (
  organizationId: string,
  userId: string,
  role: OrganizationRole
): Promise<OrganizationMember> => {
  try {
    const response = await api.patch<MemberResponse>(
      `/organizations/${organizationId}/members/${userId}`,
      { role }
    );
    return response.data.member;
  } catch (error: any) {
    logger.error('Failed to change member role:', error);
    throw new Error(error.response?.data?.message || 'Failed to change member role');
  }
};

/**
 * Remove member from organization
 */
export const removeMember = async (
  organizationId: string,
  userId: string
): Promise<void> => {
  try {
    await api.delete(`/organizations/${organizationId}/members/${userId}`);
  } catch (error: any) {
    logger.error('Failed to remove member:', error);
    throw new Error(error.response?.data?.message || 'Failed to remove member');
  }
};

/**
 * Leave organization (for non-owners)
 */
export const leaveOrganization = async (organizationId: string): Promise<void> => {
  try {
    await api.post(`/organizations/${organizationId}/leave`);
  } catch (error: any) {
    logger.error('Failed to leave organization:', error);
    throw new Error(error.response?.data?.message || 'Failed to leave organization');
  }
};

/**
 * Invite member to organization
 */
export const inviteMember = async (
  organizationId: string,
  data: InviteMemberRequest
): Promise<OrganizationInvitation> => {
  try {
    const response = await api.post<InvitationResponse>(
      `/organizations/${organizationId}/members/invite`,
      data
    );
    return response.data.invitation;
  } catch (error: any) {
    logger.error('Failed to invite member:', error);
    throw new Error(error.response?.data?.message || 'Failed to send invitation');
  }
};

/**
 * Invitation validation response
 */
export interface InvitationValidation {
  id: string;
  email: string;
  role: OrganizationRole;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Validate an invitation token (public endpoint)
 */
export const validateInvitation = async (
  token: string
): Promise<InvitationValidation> => {
  try {
    const response = await api.get<{ success: boolean; data: { invitation: InvitationValidation } }>(
      `/invites/${token}`
    );
    return response.data.data.invitation;
  } catch (error: any) {
    logger.error('Failed to validate invitation:', error);
    const status = error.response?.status;
    if (status === 404) {
      throw new Error('Invitation not found');
    }
    if (status === 410) {
      throw new Error(error.response?.data?.error || 'Invitation is no longer valid');
    }
    throw new Error(error.response?.data?.error || 'Failed to validate invitation');
  }
};

/**
 * Accept an invitation (authenticated endpoint)
 */
export const acceptInvitation = async (
  token: string
): Promise<{ membership: OrganizationMember; organization: Organization }> => {
  try {
    const response = await api.post<{
      success: boolean;
      data: { membership: OrganizationMember; organization: Organization };
    }>(`/invites/${token}/accept`);
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to accept invitation:', error);
    throw new Error(error.response?.data?.error || 'Failed to accept invitation');
  }
};

export default {
  createOrganization,
  getMyOrganization,
  updateOrganization,
  deleteOrganization,
  getOrganizationMembers,
  changeMemberRole,
  removeMember,
  leaveOrganization,
  inviteMember,
  validateInvitation,
  acceptInvitation,
};
