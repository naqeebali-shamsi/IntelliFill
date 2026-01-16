/**
 * ClientSelector Component
 *
 * Allows users to select an existing client or create a new one
 * to save their extracted profile data to.
 */

import * as React from 'react';
import { Search, Building2, User, FileText, Plus, Check, Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { clientsService, type Client, type ClientType } from '@/services/clientsService';

// =================== TYPES ===================

export interface ClientSelectorProps {
  /** Callback when an existing client is selected */
  onSelectExisting: (clientId: string, clientName: string) => void;
  /** Callback when a new client should be created */
  onCreateNew: (name: string, type: ClientType) => void;
  /** Callback when selection is cancelled */
  onCancel: () => void;
  /** Currently selected client ID (for highlighting) */
  selectedClientId?: string;
  /** Default name for new client (pre-filled from extracted data) */
  defaultName?: string;
  /** Whether an operation is in progress */
  isLoading?: boolean;
}

// =================== DEBOUNCE HOOK ===================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// =================== CLIENT LIST ITEM ===================

interface ClientListItemProps {
  client: Client & { documentCount?: number };
  isSelected: boolean;
  onSelect: () => void;
}

function ClientListItem({ client, isSelected, onSelect }: ClientListItemProps) {
  const TypeIcon = client.type === 'COMPANY' ? Building2 : User;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full',
          client.type === 'COMPANY' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary'
        )}
      >
        <TypeIcon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{client.name}</span>
          <Badge variant="outline" className="text-xs">
            {client.type === 'COMPANY' ? 'Company' : 'Individual'}
          </Badge>
        </div>
        {client.documentCount !== undefined && (
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>
              {client.documentCount} document{client.documentCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      {isSelected && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}

// =================== MAIN COMPONENT ===================

export function ClientSelector({
  onSelectExisting,
  onCreateNew,
  onCancel,
  selectedClientId,
  defaultName = '',
  isLoading = false,
}: ClientSelectorProps) {
  // Tab state
  const [activeTab, setActiveTab] = React.useState<'existing' | 'new'>('existing');

  // Existing client search state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [clients, setClients] = React.useState<(Client & { documentCount?: number })[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(selectedClientId || null);
  const [selectedName, setSelectedName] = React.useState<string>('');

  // New client form state
  const [newClientName, setNewClientName] = React.useState(defaultName);
  const [newClientType, setNewClientType] = React.useState<ClientType>('INDIVIDUAL');

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch clients when search changes
  React.useEffect(() => {
    async function fetchClients() {
      setIsSearching(true);
      setSearchError(null);

      try {
        const response = await clientsService.getClients({
          search: debouncedSearch || undefined,
          status: 'ACTIVE',
          limit: 10,
        });
        setClients(response.data.clients);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
        setSearchError('Failed to load clients. Please try again.');
        setClients([]);
      } finally {
        setIsSearching(false);
      }
    }

    fetchClients();
  }, [debouncedSearch]);

  // Handle client selection
  const handleSelectClient = (client: Client) => {
    setSelectedId(client.id);
    setSelectedName(client.name);
  };

  // Confirm existing client selection
  const handleConfirmExisting = () => {
    if (selectedId && selectedName) {
      onSelectExisting(selectedId, selectedName);
    }
  };

  // Confirm new client creation
  const handleConfirmNew = () => {
    if (newClientName.trim()) {
      onCreateNew(newClientName.trim(), newClientType);
    }
  };

  // Validation
  const canConfirmExisting = selectedId !== null;
  const canConfirmNew = newClientName.trim().length > 0;

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'existing' | 'new')}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Existing Client
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Client
          </TabsTrigger>
        </TabsList>

        {/* Existing Client Tab */}
        <TabsContent value="existing" className="mt-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Input
              placeholder="Search clients by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              showClearButton
              onClear={() => setSearchQuery('')}
            />
          </div>

          {/* Client List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {isSearching ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Searching...
              </div>
            ) : searchError ? (
              <div className="text-center py-8 text-error">{searchError}</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? (
                  <>No clients found matching "{searchQuery}"</>
                ) : (
                  <>No clients yet. Create your first client below.</>
                )}
              </div>
            ) : (
              clients.map((client) => (
                <ClientListItem
                  key={client.id}
                  client={client}
                  isSelected={selectedId === client.id}
                  onSelect={() => handleSelectClient(client)}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* New Client Tab */}
        <TabsContent value="new" className="mt-4 space-y-4">
          <div className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <label htmlFor="new-client-name" className="text-sm font-medium">
                Client Name <span className="text-error">*</span>
              </label>
              <Input
                id="new-client-name"
                placeholder="Enter client name..."
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                leftIcon={<User className="h-4 w-4" />}
              />
            </div>

            {/* Type Select */}
            <div className="space-y-2">
              <label htmlFor="new-client-type" className="text-sm font-medium">
                Client Type
              </label>
              <Select
                value={newClientType}
                onValueChange={(value) => setNewClientType(value as ClientType)}
              >
                <SelectTrigger id="new-client-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Individual
                    </div>
                  </SelectItem>
                  <SelectItem value="COMPANY">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Company
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        {activeTab === 'existing' ? (
          <Button onClick={handleConfirmExisting} disabled={!canConfirmExisting || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save to Client
              </>
            )}
          </Button>
        ) : (
          <Button onClick={handleConfirmNew} disabled={!canConfirmNew || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create & Save
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
