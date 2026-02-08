/** API response types matching IntelliFill backend */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
  message?: string;
}

export interface RefreshResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface UserProfileResponse {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

export interface UserProfile {
  fields: ProfileField[];
  documentCount: number;
}

export interface ProfileField {
  key: string;
  values: string[];
  confidence: number;
  sourceCount: number;
  lastUpdated: string;
}

export interface ClientProfile {
  id: string;
  clientId: string;
  fields: ProfileField[];
  updatedAt: string;
}

export interface APIErrorResponse {
  success: false;
  message: string;
  code?: string;
}
