import { useState, useEffect } from 'react';
import type { User, UserProfile } from '../../shared/types/api';
import type { AuthCheckResult, LoginResult, ProfileResult, UserResult } from '../../shared/types/messages';
import LoginView from './components/LoginView';
import MainView from './components/MainView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = (await browser.runtime.sendMessage({
        action: 'isAuthenticated',
      })) as AuthCheckResult;

      if (response.authenticated) {
        await loadUserData();
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }

  async function loadUserData() {
    const [userResponse, profileResponse] = await Promise.all([
      browser.runtime.sendMessage({ action: 'getCurrentUser' }) as Promise<UserResult>,
      browser.runtime.sendMessage({ action: 'getProfile' }) as Promise<ProfileResult>,
    ]);

    if (userResponse.success && userResponse.user) {
      setUser(userResponse.user);
    }
    if (profileResponse.success && profileResponse.profile) {
      setProfile(profileResponse.profile);
    }

    const settings = await browser.storage.local.get(['settings']);
    const parsed = settings.settings as { enabled?: boolean } | undefined;
    setEnabled(parsed?.enabled !== false);
  }

  async function handleLogin(email: string, password: string): Promise<string | null> {
    const response = (await browser.runtime.sendMessage({
      action: 'login',
      email,
      password,
    })) as LoginResult;

    if (response.success) {
      await loadUserData();
      setIsAuthenticated(true);
      return null;
    }
    return response.error;
  }

  async function handleLogout() {
    await browser.runtime.sendMessage({ action: 'logout' });
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
  }

  async function handleRefreshProfile() {
    const response = (await browser.runtime.sendMessage({
      action: 'getProfile',
      forceRefresh: true,
    })) as ProfileResult;

    if (response.success && response.profile) {
      setProfile(response.profile);
    }
  }

  async function handleToggle(newEnabled: boolean) {
    setEnabled(newEnabled);
    const current = await browser.storage.local.get(['settings']);
    const currentSettings = (current.settings as Record<string, unknown>) || {};
    await browser.storage.local.set({
      settings: { ...currentSettings, enabled: newEnabled },
    });
  }

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-5 py-4">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 2L7 8H3L8 12L6 18L12 14L18 18L16 12L21 8H17L15 2H9Z"
              fill="currentColor"
            />
          </svg>
          <h1 className="text-lg font-semibold">IntelliFill</h1>
        </div>
      </div>

      {/* Content */}
      {isAuthenticated ? (
        <MainView
          user={user}
          profile={profile}
          enabled={enabled}
          onLogout={handleLogout}
          onRefresh={handleRefreshProfile}
          onToggle={handleToggle}
        />
      ) : (
        <LoginView onLogin={handleLogin} />
      )}
    </div>
  );
}
