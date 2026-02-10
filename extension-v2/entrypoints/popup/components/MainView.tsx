import { useState } from 'react';
import type { User, UserProfile } from '../../../shared/types/api';

interface MainViewProps {
  user: User | null;
  profile: UserProfile | null;
  enabled: boolean;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  onToggle: (enabled: boolean) => void;
}

export default function MainView({
  user,
  profile,
  enabled,
  onLogout,
  onRefresh,
  onToggle,
}: MainViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  }

  return (
    <div>
      {/* Status Section */}
      <div className="p-5 border-b border-gray-100">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div
                className={`w-2 h-2 rounded-full animate-pulse ${
                  enabled ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              <span className={enabled ? 'text-emerald-600' : 'text-red-500'}>
                {enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <label className="relative inline-block w-11 h-6 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => onToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-indigo-500 transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            {enabled ? 'Extension is ready to auto-fill forms' : 'Extension is paused'}
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-3">
          Profile
        </h3>

        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Loading...'}
            </div>
            <div className="text-xs text-gray-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleRefresh}
            title="Refresh profile"
            className="p-2 text-indigo-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className={refreshing ? 'animate-spin' : ''}
            >
              <path
                d="M21.5 2V8M21.5 8H15.5M21.5 8L18 4.5C16.5 3 14.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22C16.5 22 20.5 19 21.5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-500">
              {profile?.fields?.length ?? 0}
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">
              Profile Fields
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <div className="text-2xl font-bold text-indigo-500">
              {profile?.documentCount ?? 0}
            </div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Documents</div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-3">
          Keyboard Shortcuts
        </h3>
        <div className="flex flex-col gap-2.5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              Ctrl
            </kbd>
            +
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              Shift
            </kbd>
            +
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              F
            </kbd>
            <span className="ml-auto text-gray-400">Show suggestions</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              Ctrl
            </kbd>
            +
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              Shift
            </kbd>
            +
            <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-[11px] font-mono shadow-sm">
              R
            </kbd>
            <span className="ml-auto text-gray-400">Refresh profile</span>
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="p-5">
        <button
          onClick={onLogout}
          className="w-full py-3 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
