/**
 * Clients Store
 *
 * Zustand store for managing client list state including
 * filters, pagination, and selection.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as React from 'react';

import { applyDevtools } from './utils/index.js';
import {
  clientsService,
  type Client,
  type ClientSummary,
  type ClientType,
  type ClientStatus,
} from '@/services/clientsService';

// =================== TYPES ===================

export type ClientTypeFilter = ClientType | 'all';
export type ClientStatusFilter = ClientStatus | 'all';

// =================== STORE STATE ===================

interface ClientsState {
  // Data
  clients: Client[];
  selectedClient: ClientSummary | null;
  total: number;

  // Loading state
  loading: boolean;
  error: string | null;

  // Filters
  search: string;
  type: ClientTypeFilter;
  status: ClientStatusFilter;

  // Pagination
  limit: number;
  offset: number;
}

interface ClientsActions {
  // Data fetching
  fetchClients: () => Promise<void>;
  selectClient: (id: string) => Promise<void>;
  clearSelectedClient: () => void;

  // Filter actions
  setSearch: (search: string) => void;
  setTypeFilter: (type: ClientTypeFilter) => void;
  setStatusFilter: (status: ClientStatusFilter) => void;

  // Pagination
  nextPage: () => void;
  prevPage: () => void;
  setLimit: (limit: number) => void;

  // Client operations
  archiveClient: (id: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;

  // Reset
  reset: () => void;
}

type ClientsStore = ClientsState & ClientsActions;

// =================== INITIAL STATE ===================

const initialState: ClientsState = {
  clients: [],
  selectedClient: null,
  total: 0,
  loading: false,
  error: null,
  search: '',
  type: 'all',
  status: 'all',
  limit: 20,
  offset: 0,
};

// =================== STORE IMPLEMENTATION ===================

export const useClientsStore = create<ClientsStore>()(
  applyDevtools(
    immer((set, get) => ({
      ...initialState,

      // =================== DATA FETCHING ===================

      fetchClients: async () => {
        const { search, type, status, limit, offset } = get();

        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const response = await clientsService.getClients({
            search: search || undefined,
            type: type === 'all' ? undefined : type,
            status: status === 'all' ? undefined : status,
            limit,
            offset,
          });

          set((state) => {
            state.clients = response.data.clients;
            state.total = response.data.total;
            state.loading = false;
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to fetch clients';
          set((state) => {
            state.error = message;
            state.loading = false;
          });
        }
      },

      selectClient: async (id: string) => {
        set((state) => {
          state.loading = true;
          state.error = null;
        });

        try {
          const response = await clientsService.getClientSummary(id);
          set((state) => {
            state.selectedClient = response.data.client;
            state.loading = false;
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to fetch client';
          set((state) => {
            state.error = message;
            state.loading = false;
          });
        }
      },

      clearSelectedClient: () => {
        set((state) => {
          state.selectedClient = null;
        });
      },

      // =================== FILTER ACTIONS ===================

      setSearch: (search: string) => {
        set((state) => {
          state.search = search;
          state.offset = 0; // Reset pagination on filter change
        });
      },

      setTypeFilter: (type: ClientTypeFilter) => {
        set((state) => {
          state.type = type;
          state.offset = 0; // Reset pagination on filter change
        });
      },

      setStatusFilter: (status: ClientStatusFilter) => {
        set((state) => {
          state.status = status;
          state.offset = 0; // Reset pagination on filter change
        });
      },

      // =================== PAGINATION ===================

      nextPage: () => {
        const { offset, limit, total } = get();
        if (offset + limit < total) {
          set((state) => {
            state.offset = offset + limit;
          });
        }
      },

      prevPage: () => {
        const { offset, limit } = get();
        if (offset > 0) {
          set((state) => {
            state.offset = Math.max(0, offset - limit);
          });
        }
      },

      setLimit: (limit: number) => {
        set((state) => {
          state.limit = limit;
          state.offset = 0; // Reset pagination on limit change
        });
      },

      // =================== CLIENT OPERATIONS ===================

      archiveClient: async (id: string) => {
        try {
          await clientsService.archiveClient(id);
          // Refresh the list after archiving
          await get().fetchClients();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to archive client';
          set((state) => {
            state.error = message;
          });
          throw error;
        }
      },

      restoreClient: async (id: string) => {
        try {
          await clientsService.restoreClient(id);
          // Refresh the list after restoring
          await get().fetchClients();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to restore client';
          set((state) => {
            state.error = message;
          });
          throw error;
        }
      },

      // =================== RESET ===================

      reset: () => {
        set(initialState);
      },
    })),
    'IntelliFill Clients Store'
  )
);

// =================== SELECTORS ===================

export const clientsSelectors = {
  clients: (state: ClientsStore) => state.clients,
  selectedClient: (state: ClientsStore) => state.selectedClient,
  total: (state: ClientsStore) => state.total,
  loading: (state: ClientsStore) => state.loading,
  error: (state: ClientsStore) => state.error,
  search: (state: ClientsStore) => state.search,
  type: (state: ClientsStore) => state.type,
  status: (state: ClientsStore) => state.status,
  limit: (state: ClientsStore) => state.limit,
  offset: (state: ClientsStore) => state.offset,
};

// =================== HOOKS ===================

/**
 * Hook for client filters management
 */
export const useClientsFilters = () => {
  const search = useClientsStore((state) => state.search);
  const type = useClientsStore((state) => state.type);
  const status = useClientsStore((state) => state.status);
  const setSearch = useClientsStore((state) => state.setSearch);
  const setTypeFilter = useClientsStore((state) => state.setTypeFilter);
  const setStatusFilter = useClientsStore((state) => state.setStatusFilter);

  const hasActiveFilters = React.useMemo(() => {
    return search !== '' || type !== 'all' || status !== 'all';
  }, [search, type, status]);

  return React.useMemo(
    () => ({
      search,
      type,
      status,
      setSearch,
      setTypeFilter,
      setStatusFilter,
      hasActiveFilters,
    }),
    [search, type, status, setSearch, setTypeFilter, setStatusFilter, hasActiveFilters]
  );
};

/**
 * Hook for clients pagination management
 */
export const useClientsPagination = () => {
  const offset = useClientsStore((state) => state.offset);
  const limit = useClientsStore((state) => state.limit);
  const total = useClientsStore((state) => state.total);
  const nextPage = useClientsStore((state) => state.nextPage);
  const prevPage = useClientsStore((state) => state.prevPage);
  const setLimit = useClientsStore((state) => state.setLimit);

  const hasNext = React.useMemo(() => offset + limit < total, [offset, limit, total]);
  const hasPrev = React.useMemo(() => offset > 0, [offset]);
  const currentPage = React.useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const totalPages = React.useMemo(() => Math.ceil(total / limit) || 1, [total, limit]);

  return React.useMemo(
    () => ({
      offset,
      limit,
      total,
      hasNext,
      hasPrev,
      currentPage,
      totalPages,
      nextPage,
      prevPage,
      setLimit,
    }),
    [offset, limit, total, hasNext, hasPrev, currentPage, totalPages, nextPage, prevPage, setLimit]
  );
};
