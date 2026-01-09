/**
 * Account Service
 *
 * API service for user account management including profile and settings.
 * Task 386: Frontend account service for profile and settings management.
 *
 * @module services/accountService
 */

import api from './api';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * User profile data returned from the API
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  bio: string | null;
  updatedAt: string;
}

/**
 * User settings data returned from the API
 */
export interface UserSettings {
  // Language & Localization
  preferredLanguage?: string;
  timezone?: string;

  // Notification Preferences
  emailNotifications?: boolean;
  notifyOnProcessComplete?: boolean;
  notifyOnOrgInvite?: boolean;
  digestFrequency?: 'daily' | 'weekly' | 'never';

  // UI Preferences
  theme?: 'light' | 'dark' | 'system';
  compactMode?: boolean;

  // Processing Preferences
  autoOcr?: boolean;
  autoMlEnhancement?: boolean;
  defaultOutputFormat?: 'pdf' | 'docx';

  // Integration
  webhookUrl?: string | null;
}

/**
 * Profile update request data
 */
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
}

/**
 * Settings update request data
 */
export interface UpdateSettingsData {
  preferredLanguage?: string;
  timezone?: string;
  emailNotifications?: boolean;
  notifyOnProcessComplete?: boolean;
  notifyOnOrgInvite?: boolean;
  digestFrequency?: 'daily' | 'weekly' | 'never';
  theme?: 'light' | 'dark' | 'system';
  compactMode?: boolean;
  autoOcr?: boolean;
  autoMlEnhancement?: boolean;
  defaultOutputFormat?: 'pdf' | 'docx';
  webhookUrl?: string | null;
}

// ============================================================================
// API Response Types
// ============================================================================

interface ProfileResponse {
  success: boolean;
  data: {
    user: UserProfile;
  };
}

interface SettingsResponse {
  success: boolean;
  data: {
    settings: UserSettings;
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get user profile
 * @returns User profile object with all profile fields
 */
export const getProfile = async (): Promise<UserProfile> => {
  try {
    const response = await api.get<ProfileResponse>('/users/me/profile');
    return response.data.data.user;
  } catch (error: unknown) {
    logger.error('Failed to fetch user profile:', error);
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    throw new Error(err.response?.data?.error || err.message || 'Failed to fetch profile');
  }
};

/**
 * Get user settings
 * @returns User settings object (empty object if no settings exist)
 */
export const getSettings = async (): Promise<UserSettings> => {
  try {
    const response = await api.get<SettingsResponse>('/users/me/settings');
    return response.data.data.settings || {};
  } catch (error: unknown) {
    logger.error('Failed to fetch user settings:', error);
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    throw new Error(err.response?.data?.error || err.message || 'Failed to fetch settings');
  }
};

/**
 * Update user settings
 * @param data - Partial settings data to update
 * @returns Updated settings object
 */
export const updateSettings = async (data: UpdateSettingsData): Promise<UserSettings> => {
  try {
    const response = await api.patch<SettingsResponse>('/users/me/settings', data);
    return response.data.data.settings;
  } catch (error: unknown) {
    logger.error('Failed to update user settings:', error);
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    throw new Error(err.response?.data?.error || err.message || 'Failed to update settings');
  }
};

/**
 * Update user profile
 * @param data - Partial profile data to update
 * @returns Updated user profile
 */
export const updateProfile = async (data: UpdateProfileData): Promise<UserProfile> => {
  try {
    const response = await api.patch<ProfileResponse>('/users/me/profile', data);
    return response.data.data.user;
  } catch (error: unknown) {
    logger.error('Failed to update user profile:', error);
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    throw new Error(err.response?.data?.error || err.message || 'Failed to update profile');
  }
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  getProfile,
  getSettings,
  updateSettings,
  updateProfile,
};
