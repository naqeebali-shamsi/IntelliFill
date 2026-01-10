import api from './api';
import { logger } from '@/utils/logger';

export interface ProfileFieldValue {
  key: string;
  values: string[];
  sourceCount: number;
  confidence: number;
  lastUpdated: string;
}

export interface UserProfile {
  userId: string;
  fields: ProfileFieldValue[];
  lastAggregated: string;
  documentCount: number;
}

export interface ProfileResponse {
  success: boolean;
  profile: UserProfile;
  message?: string;
}

export interface ProfileFieldResponse {
  success: boolean;
  field: ProfileFieldValue;
}

export interface AuditLogEntry {
  id: string;
  fieldName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValue: string[] | null;
  newValue: string[] | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditHistoryResponse {
  success: boolean;
  logs: AuditLogEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Get user's aggregated profile
 * Returns aggregated data from all user's documents
 */
export const getProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.get<ProfileResponse>('/users/me/profile');
    return response.data.profile;
  } catch (error: any) {
    logger.error('Failed to fetch profile:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch profile');
  }
};

/**
 * Update user profile
 * Allows users to add or modify profile fields
 */
export const updateProfile = async (updates: Record<string, any>): Promise<UserProfile> => {
  try {
    const response = await api.put<ProfileResponse>('/users/me/profile', updates);
    return response.data.profile;
  } catch (error: any) {
    logger.error('Failed to update profile:', error);
    throw new Error(error.response?.data?.message || 'Failed to update profile');
  }
};

/**
 * Refresh profile by re-aggregating from all documents
 */
export const refreshProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.post<ProfileResponse>('/users/me/profile/refresh');
    return response.data.profile;
  } catch (error: any) {
    logger.error('Failed to refresh profile:', error);
    throw new Error(error.response?.data?.message || 'Failed to refresh profile');
  }
};

/**
 * Delete user profile
 * Removes aggregated profile data (documents remain intact)
 */
export const deleteProfile = async (): Promise<void> => {
  try {
    await api.delete('/users/me/profile');
  } catch (error: any) {
    logger.error('Failed to delete profile:', error);
    throw new Error(error.response?.data?.message || 'Failed to delete profile');
  }
};

/**
 * Get specific field from profile
 */
export const getProfileField = async (fieldKey: string): Promise<ProfileFieldValue> => {
  try {
    const response = await api.get<ProfileFieldResponse>(`/users/me/profile/field/${fieldKey}`);
    return response.data.field;
  } catch (error: any) {
    logger.error(`Failed to fetch profile field ${fieldKey}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch profile field');
  }
};

/**
 * Delete a specific field from profile
 */
export const deleteProfileField = async (fieldKey: string): Promise<UserProfile> => {
  try {
    // Get current profile
    const profile = await getProfile();

    // Remove the field
    const updatedFields: Record<string, any> = {};
    profile.fields.forEach((field) => {
      if (field.key !== fieldKey) {
        // Keep all fields except the one we want to delete
        updatedFields[field.key] = field.values;
      }
    });

    // Update profile with remaining fields
    return await updateProfile(updatedFields);
  } catch (error: any) {
    logger.error(`Failed to delete profile field ${fieldKey}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to delete profile field');
  }
};

/**
 * Add or update a single field in the profile
 */
export const updateProfileField = async (
  fieldKey: string,
  values: string | string[]
): Promise<UserProfile> => {
  try {
    const normalizedValues = Array.isArray(values) ? values : [values];
    return await updateProfile({ [fieldKey]: normalizedValues });
  } catch (error: any) {
    logger.error(`Failed to update profile field ${fieldKey}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to update profile field');
  }
};

/**
 * Get audit history for user's profile
 * Returns paginated list of profile changes
 */
export const getAuditHistory = async (
  options: { limit?: number; offset?: number } = {}
): Promise<AuditHistoryResponse> => {
  try {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const queryString = params.toString();
    const url = `/users/me/profile/audit${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<AuditHistoryResponse>(url);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to fetch audit history:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch audit history');
  }
};

export default {
  getProfile,
  updateProfile,
  refreshProfile,
  deleteProfile,
  getProfileField,
  deleteProfileField,
  updateProfileField,
  getAuditHistory,
};
