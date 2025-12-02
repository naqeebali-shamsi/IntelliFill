/**
 * IntelliFill Background Service Worker
 *
 * Handles API communication, authentication, and profile caching
 */

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// State
let profileCache = null;
let cacheTimestamp = 0;

console.log('IntelliFill: Background service worker started');

/**
 * Get authentication token
 */
async function getAuthToken() {
  const result = await chrome.storage.local.get(['authToken']);
  return result.authToken || null;
}

/**
 * Set authentication token
 */
async function setAuthToken(token) {
  await chrome.storage.local.set({ authToken: token });
}

/**
 * Clear authentication token
 */
async function clearAuthToken() {
  await chrome.storage.local.remove(['authToken', 'profile', 'profileTimestamp']);
  profileCache = null;
  cacheTimestamp = 0;
}

/**
 * Check if user is authenticated
 */
async function isAuthenticated() {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // Handle 401 - Unauthorized
    if (response.status === 401) {
      await clearAuthToken();
      throw new Error('Unauthorized - please log in again');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('IntelliFill: API request failed', error);
    throw error;
  }
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.success && data.token) {
      await setAuthToken(data.token);

      // Fetch profile immediately
      await fetchProfile(true);

      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.message || 'Login failed' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Logout user
 */
async function logout() {
  await clearAuthToken();
  return { success: true };
}

/**
 * Fetch user profile
 */
async function fetchProfile(forceRefresh = false) {
  try {
    // Check cache
    const now = Date.now();
    const isCacheValid = profileCache && (now - cacheTimestamp) < CACHE_DURATION_MS;

    if (!forceRefresh && isCacheValid) {
      return { success: true, profile: profileCache };
    }

    // Fetch from API
    const data = await apiRequest('/users/me/profile');

    if (data.success && data.profile) {
      profileCache = data.profile;
      cacheTimestamp = now;

      // Update storage
      await chrome.storage.local.set({
        profile: profileCache,
        profileTimestamp: now
      });

      return { success: true, profile: profileCache };
    } else {
      return { success: false, error: data.message || 'Failed to fetch profile' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current user
 */
async function getCurrentUser() {
  try {
    const data = await apiRequest('/users/me');

    if (data.success && data.user) {
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.message || 'Failed to fetch user' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update API endpoint
 */
async function updateApiEndpoint(endpoint) {
  await chrome.storage.local.set({ apiEndpoint: endpoint });
  // Clear cache when API endpoint changes
  profileCache = null;
  cacheTimestamp = 0;
}

/**
 * Get API endpoint
 */
async function getApiEndpoint() {
  const result = await chrome.storage.local.get(['apiEndpoint']);
  return result.apiEndpoint || API_BASE_URL;
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('IntelliFill: Received message', message.action);

  switch (message.action) {
    case 'login':
      login(message.email, message.password).then(sendResponse);
      return true; // Keep channel open for async response

    case 'logout':
      logout().then(sendResponse);
      return true;

    case 'getProfile':
      fetchProfile(message.forceRefresh).then(sendResponse);
      return true;

    case 'getCurrentUser':
      getCurrentUser().then(sendResponse);
      return true;

    case 'isAuthenticated':
      isAuthenticated().then(authenticated => {
        sendResponse({ authenticated });
      });
      return true;

    case 'updateApiEndpoint':
      updateApiEndpoint(message.endpoint).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'getApiEndpoint':
      getApiEndpoint().then(endpoint => {
        sendResponse({ endpoint });
      });
      return true;

    case 'clearCache':
      profileCache = null;
      cacheTimestamp = 0;
      chrome.storage.local.remove(['profile', 'profileTimestamp']).then(() => {
        sendResponse({ success: true });
      });
      return true;
  }
});

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('IntelliFill: Extension installed');

    // Set default settings
    chrome.storage.local.set({
      enabled: true,
      apiEndpoint: API_BASE_URL
    });

    // Open welcome page
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html')
    });
  } else if (details.reason === 'update') {
    console.log('IntelliFill: Extension updated');
    // Clear cache on update
    profileCache = null;
    cacheTimestamp = 0;
  }
});

/**
 * Periodic profile refresh (every 5 minutes if user is active)
 */
chrome.alarms.create('refreshProfile', {
  periodInMinutes: 5
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshProfile') {
    const authenticated = await isAuthenticated();
    if (authenticated) {
      console.log('IntelliFill: Periodic profile refresh');
      await fetchProfile(true);

      // Notify active tabs to refresh
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'refreshProfile' }).catch(() => {
            // Ignore errors for tabs without content script
          });
        });
      });
    }
  }
});
