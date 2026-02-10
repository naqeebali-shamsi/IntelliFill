import type { User, UserProfile } from './api';
import type { FieldContext, FieldInferenceResult } from './field-matching';

/** Discriminated union for background service worker messages */

export type BackgroundMessage =
  | { action: 'login'; email: string; password: string }
  | { action: 'logout' }
  | { action: 'getProfile'; forceRefresh?: boolean }
  | { action: 'getCurrentUser' }
  | { action: 'isAuthenticated' }
  | { action: 'clearCache' }
  | { action: 'inferFields'; fields: FieldContext[]; profileKeys: string[] };

/** Response types mapped to each message action */
export type LoginResult = { success: true; user: User } | { success: false; error: string };
export type LogoutResult = { success: boolean };
export type ProfileResult =
  | { success: true; profile: UserProfile }
  | { success: false; error: string };
export type UserResult = { success: true; user: User } | { success: false; error: string };
export type AuthCheckResult = { authenticated: boolean };
export type CacheResult = { success: boolean };

/** Content script messages */
export type ContentMessage =
  | { action: 'refreshProfile' }
  | { action: 'toggleExtension'; enabled: boolean }
  | { action: 'getStatus' }
  | { action: 'fillAll' }
  | { action: 'inferFields' };

export interface ContentStatus {
  enabled: boolean;
  hasProfile: boolean;
  fieldsProcessed: number;
}

export type InferFieldsResult =
  | { success: true; mappings: FieldInferenceResult[] }
  | { success: false; error: string };
