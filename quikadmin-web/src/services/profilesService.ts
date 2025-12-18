/**
 * Profiles Service - API calls for B2C profile management
 * B2C-focused: Profiles represent different identities a user fills forms for
 * (Personal, Spouse, Business, Parent, etc.)
 * @module services/profilesService
 */

import api from './api';
import type {
  Profile,
  ProfileWithData,
  CreateProfileDto,
  UpdateProfileDto,
  ProfileFilter,
  ProfileSort,
  ProfileListResponse,
  ProfileResponse,
  ProfileType,
} from '@/types/profile';
import { mapProfileTypeToClientType, mapClientTypeToProfileType } from '@/types/profile';

export interface ListProfilesParams {
  filter?: ProfileFilter;
  sort?: ProfileSort;
  limit?: number;
  offset?: number;
}

// Transform backend response to frontend Profile type
function transformProfile(backendProfile: any): Profile {
  return {
    id: backendProfile.id,
    userId: backendProfile.userId,
    name: backendProfile.name,
    type: mapClientTypeToProfileType(backendProfile.type),
    status: backendProfile.status,
    notes: backendProfile.notes,
    createdAt: backendProfile.createdAt,
    updatedAt: backendProfile.updatedAt,
  };
}

export const profilesService = {
  /**
   * Get all profiles for the current user
   */
  async list(
    params: ListProfilesParams = {}
  ): Promise<{
    success: boolean;
    data: { profiles: Profile[]; pagination: ProfileListResponse['data']['pagination'] };
  }> {
    const { filter = {}, sort, limit = 20, offset = 0 } = params;

    const queryParams = new URLSearchParams();

    if (filter.search) queryParams.set('search', filter.search);
    // Map frontend ProfileType to backend ClientType for API
    if (filter.type) queryParams.set('type', mapProfileTypeToClientType(filter.type));
    if (filter.status) queryParams.set('status', filter.status);
    if (sort?.field) queryParams.set('sortBy', sort.field);
    if (sort?.order) queryParams.set('sortOrder', sort.order);
    queryParams.set('limit', String(limit));
    queryParams.set('offset', String(offset));

    // Backend uses /clients endpoint - we transform the response
    const response = await api.get<ProfileListResponse>(`/clients?${queryParams.toString()}`);

    // Transform backend 'clients' to frontend 'profiles'
    return {
      success: response.data.success,
      data: {
        profiles: response.data.data.clients.map(transformProfile),
        pagination: response.data.data.pagination,
      },
    };
  },

  /**
   * Get a single profile by ID
   */
  async getById(id: string): Promise<Profile> {
    const response = await api.get<ProfileResponse>(`/clients/${id}`);
    return transformProfile(response.data.data.client);
  },

  /**
   * Get a profile with their profile data
   */
  async getWithData(id: string): Promise<ProfileWithData> {
    const response = await api.get<{ success: boolean; data: { client: any } }>(
      `/clients/${id}?include=profile`
    );
    const backendClient = response.data.data.client;
    return {
      ...transformProfile(backendClient),
      profileData: backendClient.profile,
    };
  },

  /**
   * Create a new profile
   */
  async create(data: CreateProfileDto): Promise<Profile> {
    // Map frontend ProfileType to backend ClientType
    const backendData = {
      name: data.name,
      type: data.type ? mapProfileTypeToClientType(data.type) : 'INDIVIDUAL',
      notes: data.notes,
    };
    const response = await api.post<ProfileResponse>('/clients', backendData);
    return transformProfile(response.data.data.client);
  },

  /**
   * Update an existing profile
   */
  async update(id: string, data: UpdateProfileDto): Promise<Profile> {
    // Map frontend ProfileType to backend ClientType if present
    const backendData: any = { ...data };
    if (data.type) {
      backendData.type = mapProfileTypeToClientType(data.type);
    }
    const response = await api.put<ProfileResponse>(`/clients/${id}`, backendData);
    return transformProfile(response.data.data.client);
  },

  /**
   * Delete a profile
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },

  /**
   * Archive a profile (soft delete)
   */
  async archive(id: string): Promise<Profile> {
    return this.update(id, { status: 'ARCHIVED' });
  },

  /**
   * Restore an archived profile
   */
  async restore(id: string): Promise<Profile> {
    return this.update(id, { status: 'ACTIVE' });
  },

  /**
   * Get profile statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    archived: number;
    business: number;
    personal: number;
  }> {
    const response = await this.list({ limit: 1000 });
    const profiles = response.data.profiles;

    return {
      total: profiles.length,
      active: profiles.filter((p: Profile) => p.status === 'ACTIVE').length,
      archived: profiles.filter((p: Profile) => p.status === 'ARCHIVED').length,
      business: profiles.filter((p: Profile) => p.type === 'BUSINESS').length,
      personal: profiles.filter((p: Profile) => p.type === 'PERSONAL').length,
    };
  },
};

export default profilesService;
