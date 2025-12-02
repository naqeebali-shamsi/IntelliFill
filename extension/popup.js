/**
 * IntelliFill Popup Script
 *
 * Handles popup UI interactions
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loginView = document.getElementById('loginView');
  const mainView = document.getElementById('mainView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const enableToggle = document.getElementById('enableToggle');
  const refreshButton = document.getElementById('refreshButton');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');

  let currentUser = null;
  let currentProfile = null;

  /**
   * Show error message
   */
  function showError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
  }

  /**
   * Hide error message
   */
  function hideError() {
    loginError.style.display = 'none';
  }

  /**
   * Show loading state
   */
  function setLoading(loading) {
    const spinner = loginButton.querySelector('.spinner');
    const span = loginButton.querySelector('span');

    if (loading) {
      spinner.style.display = 'inline-block';
      span.textContent = 'Signing in...';
      loginButton.disabled = true;
    } else {
      spinner.style.display = 'none';
      span.textContent = 'Sign In';
      loginButton.disabled = false;
    }
  }

  /**
   * Check authentication and show appropriate view
   */
  async function checkAuth() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'isAuthenticated' });

      if (response.authenticated) {
        await loadUserData();
        showMainView();
      } else {
        showLoginView();
      }
    } catch (error) {
      console.error('Failed to check auth:', error);
      showLoginView();
    }
  }

  /**
   * Load user data
   */
  async function loadUserData() {
    try {
      // Get current user
      const userResponse = await chrome.runtime.sendMessage({ action: 'getCurrentUser' });
      if (userResponse.success && userResponse.user) {
        currentUser = userResponse.user;
        document.getElementById('userName').textContent = currentUser.name || currentUser.email;
        document.getElementById('userEmail').textContent = currentUser.email;
      }

      // Get profile
      const profileResponse = await chrome.runtime.sendMessage({ action: 'getProfile' });
      if (profileResponse.success && profileResponse.profile) {
        currentProfile = profileResponse.profile;
        document.getElementById('fieldCount').textContent = currentProfile.fields?.length || 0;
        document.getElementById('documentCount').textContent = currentProfile.documentCount || 0;
      }

      // Get settings
      const settings = await chrome.storage.local.get(['enabled', 'apiEndpoint']);
      enableToggle.checked = settings.enabled !== false;
      updateStatus(settings.enabled !== false);

      if (settings.apiEndpoint) {
        document.getElementById('apiEndpoint').value = settings.apiEndpoint;
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  /**
   * Update status indicator
   */
  function updateStatus(enabled) {
    if (enabled) {
      statusIndicator.className = 'status-indicator status-active';
      statusText.textContent = 'Active';
    } else {
      statusIndicator.className = 'status-indicator status-inactive';
      statusText.textContent = 'Inactive';
    }
  }

  /**
   * Show login view
   */
  function showLoginView() {
    loginView.style.display = 'block';
    mainView.style.display = 'none';
  }

  /**
   * Show main view
   */
  function showMainView() {
    loginView.style.display = 'none';
    mainView.style.display = 'block';
  }

  /**
   * Handle login form submission
   */
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'login',
        email,
        password
      });

      if (response.success) {
        // Clear form
        loginForm.reset();

        // Load user data and show main view
        await loadUserData();
        showMainView();

        // Notify all tabs to refresh
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'refreshProfile' }).catch(() => {
              // Ignore errors
            });
          });
        });
      } else {
        showError(response.error || 'Login failed. Please try again.');
      }
    } catch (error) {
      showError('Network error. Please check your connection.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  });

  /**
   * Handle logout
   */
  logoutButton.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ action: 'logout' });

      // Clear local state
      currentUser = null;
      currentProfile = null;

      // Show login view
      showLoginView();

      // Clear form
      loginForm.reset();
      hideError();
    } catch (error) {
      console.error('Logout error:', error);
    }
  });

  /**
   * Handle enable toggle
   */
  enableToggle.addEventListener('change', async (e) => {
    const enabled = e.target.checked;

    await chrome.storage.local.set({ enabled });
    updateStatus(enabled);

    // Notify all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'toggleExtension',
          enabled
        }).catch(() => {
          // Ignore errors
        });
      });
    });
  });

  /**
   * Handle refresh button
   */
  refreshButton.addEventListener('click', async () => {
    refreshButton.classList.add('rotating');

    try {
      // Fetch fresh profile
      const response = await chrome.runtime.sendMessage({
        action: 'getProfile',
        forceRefresh: true
      });

      if (response.success && response.profile) {
        currentProfile = response.profile;
        document.getElementById('fieldCount').textContent = currentProfile.fields?.length || 0;
        document.getElementById('documentCount').textContent = currentProfile.documentCount || 0;

        // Notify all tabs to refresh
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'refreshProfile' }).catch(() => {
              // Ignore errors
            });
          });
        });
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setTimeout(() => {
        refreshButton.classList.remove('rotating');
      }, 500);
    }
  });

  // Initialize
  checkAuth();
});
