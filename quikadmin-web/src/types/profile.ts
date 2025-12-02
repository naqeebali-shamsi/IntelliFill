/**
 * Profile types for the frontend
 * B2C-focused: Profiles represent different identities a user fills forms for
 * (Personal, Spouse, Business, Parent, etc.)
 */

import { z } from 'zod';

export type ProfileType = 'PERSONAL' | 'BUSINESS';
export type ProfileStatus = 'ACTIVE' | 'ARCHIVED';

export interface Profile {
  id: string;
  userId: string;
  name: string;
  type: ProfileType;
  status: ProfileStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Note: Documents are NOT associated with profiles in B2C model
  // They are just OCR sources belonging to the user
}

export interface ProfileWithData extends Profile {
  profileData?: ProfileData;
}

export interface ProfileData {
  id: string;
  profileId: string;
  data: Record<string, any>;
  fieldSources: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileDto {
  name: string;
  type?: ProfileType;
  notes?: string;
}

export interface UpdateProfileDto {
  name?: string;
  type?: ProfileType;
  status?: ProfileStatus;
  notes?: string | null;
}

export interface ProfileFilter {
  search?: string;
  type?: ProfileType;
  status?: ProfileStatus;
}

export interface ProfileSort {
  field: 'name' | 'createdAt' | 'updatedAt';
  order: 'asc' | 'desc';
}

export interface ProfileListResponse {
  success: boolean;
  data: {
    clients: Profile[]; // Backend still returns 'clients' - we map to profiles
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

export interface ProfileResponse {
  success: boolean;
  data: {
    client: Profile; // Backend still returns 'client' - we map to profile
  };
}

// Helper functions
export function getProfileTypeLabel(type: ProfileType): string {
  return type === 'BUSINESS' ? 'Business' : 'Personal';
}

export function getProfileStatusLabel(status: ProfileStatus): string {
  return status === 'ACTIVE' ? 'Active' : 'Archived';
}

export function getProfileTypeIcon(type: ProfileType): string {
  return type === 'BUSINESS' ? 'building-2' : 'user';
}

// =================== ZOD VALIDATION SCHEMAS ===================

export const profileFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Profile name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  type: z.enum(['PERSONAL', 'BUSINESS'] as const),
  notes: z
    .string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
    .nullable()
    .transform((val) => val || null),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

// Map backend ClientType to frontend ProfileType
export function mapClientTypeToProfileType(clientType: 'COMPANY' | 'INDIVIDUAL'): ProfileType {
  return clientType === 'COMPANY' ? 'BUSINESS' : 'PERSONAL';
}

// Map frontend ProfileType to backend ClientType
export function mapProfileTypeToClientType(profileType: ProfileType): 'COMPANY' | 'INDIVIDUAL' {
  return profileType === 'BUSINESS' ? 'COMPANY' : 'INDIVIDUAL';
}
