/**
 * Clients Service
 *
 * API client for client management operations including listing,
 * searching, filtering, archiving, and CRUD operations.
 */

import api from './api';

// =================== TYPES ===================

export type ClientType = 'COMPANY' | 'INDIVIDUAL';
export type ClientStatus = 'ACTIVE' | 'ARCHIVED';

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSummary extends Client {
  documentCount: number;
  formCount: number;
  extractedDataCount: number;
  profileFieldCount: number;
}

export interface ClientListParams {
  search?: string;
  type?: ClientType | 'all';
  status?: ClientStatus | 'all';
  limit?: number;
  offset?: number;
}

export interface ClientListResponse {
  success: boolean;
  data: {
    clients: Client[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ClientDetailResponse {
  success: boolean;
  data: {
    client: Client;
  };
}

export interface ClientSummaryResponse {
  success: boolean;
  data: {
    client: ClientSummary;
  };
}

export interface CreateClientDto {
  name: string;
  type: ClientType;
  notes?: string;
}

export interface UpdateClientDto {
  name?: string;
  type?: ClientType;
  notes?: string;
}

// =================== SERVICE ===================

export const clientsService = {
  /**
   * Get list of clients with optional filtering and pagination
   */
  getClients: async (params?: ClientListParams): Promise<ClientListResponse> => {
    // Filter out 'all' values as backend expects undefined for no filter
    const cleanParams: Record<string, string | number | undefined> = {};

    if (params?.search) {
      cleanParams.search = params.search;
    }
    if (params?.type && params.type !== 'all') {
      cleanParams.type = params.type;
    }
    if (params?.status && params.status !== 'all') {
      cleanParams.status = params.status;
    }
    if (params?.limit !== undefined) {
      cleanParams.limit = params.limit;
    }
    if (params?.offset !== undefined) {
      cleanParams.offset = params.offset;
    }

    const response = await api.get<ClientListResponse>('/clients', {
      params: cleanParams,
    });
    return response.data;
  },

  /**
   * Get a single client by ID
   */
  getClientById: async (id: string): Promise<ClientDetailResponse> => {
    const response = await api.get<ClientDetailResponse>(`/clients/${id}`);
    return response.data;
  },

  /**
   * Get client summary with document and form counts
   */
  getClientSummary: async (id: string): Promise<ClientSummaryResponse> => {
    const response = await api.get<ClientSummaryResponse>(`/clients/${id}/summary`);
    return response.data;
  },

  /**
   * Create a new client
   */
  createClient: async (data: CreateClientDto): Promise<ClientDetailResponse> => {
    const response = await api.post<ClientDetailResponse>('/clients', data);
    return response.data;
  },

  /**
   * Update an existing client
   */
  updateClient: async (id: string, data: UpdateClientDto): Promise<ClientDetailResponse> => {
    const response = await api.put<ClientDetailResponse>(`/clients/${id}`, data);
    return response.data;
  },

  /**
   * Archive a client (soft delete)
   */
  archiveClient: async (id: string): Promise<ClientDetailResponse> => {
    const response = await api.post<ClientDetailResponse>(`/clients/${id}/archive`);
    return response.data;
  },

  /**
   * Restore an archived client
   */
  restoreClient: async (id: string): Promise<ClientDetailResponse> => {
    const response = await api.post<ClientDetailResponse>(`/clients/${id}/restore`);
    return response.data;
  },

  /**
   * Permanently delete a client
   */
  deleteClient: async (id: string): Promise<void> => {
    await api.delete(`/clients/${id}`);
  },
};

export default clientsService;
