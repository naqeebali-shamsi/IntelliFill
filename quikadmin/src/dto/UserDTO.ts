// Simple DTO interfaces and factory functions
// No decorators, minimal overhead

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin' | 'api';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface UserProfileDTO extends UserDTO {
  documentsProcessed: number;
  storageUsed: number;
  apiCallsToday: number;
}

// Factory function to create DTO from database model
export function toUserDTO(user: any): UserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName,
    role: user.role,
    isActive: user.is_active !== undefined ? user.is_active : user.isActive,
    emailVerified: user.email_verified !== undefined ? user.email_verified : user.emailVerified,
    createdAt: user.created_at?.toISOString() || user.createdAt,
    updatedAt: user.updated_at?.toISOString() || user.updatedAt,
    lastLogin: user.last_login?.toISOString() || user.lastLogin
  };
}

// Factory for profile with additional computed fields
export function toUserProfileDTO(user: any, stats?: any): UserProfileDTO {
  return {
    ...toUserDTO(user),
    documentsProcessed: stats?.documentsProcessed || 0,
    storageUsed: stats?.storageUsed || 0,
    apiCallsToday: stats?.apiCallsToday || 0
  };
}

// List DTO with minimal data
export interface UserListDTO {
  id: string;
  email: string;
  fullName: string;
  role: string;
  lastLogin?: string;
}

export function toUserListDTO(user: any): UserListDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName,
    role: user.role,
    lastLogin: user.last_login?.toISOString() || user.lastLogin
  };
}