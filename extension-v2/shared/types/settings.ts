/** Extension settings persisted in chrome.storage.local */
export interface ExtensionSettings {
  enabled: boolean;
  apiEndpoint: string;
  cacheMinutes: number;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  apiEndpoint: 'http://localhost:3002/api',
  cacheMinutes: 5,
};
