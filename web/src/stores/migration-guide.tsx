/**
 * Migration Guide - Example showing how to migrate from current state to Zustand stores
 */

import React, { useEffect } from 'react';
import { 
  useAuthStore, 
  useUIStore, 
  useDocumentStore, 
  useTemplateStore, 
  useSettingsStore,
  initializeStores
} from './index';

// =================== BEFORE: React State & Context ===================

// OLD WAY - Component with useState
const OldLoginForm = () => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState({ email: '', password: '' });
  
  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // API call logic here
      console.log('Logging in...');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form>
      {error && <div className="error">{error}</div>}
      {/* Form fields */}
      <button 
        onClick={handleLogin} 
        disabled={loading}
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
};

// =================== AFTER: Zustand Store ===================

// NEW WAY - Component using Zustand store
const NewLoginForm = () => {
  const { login, isLoading, error, clearError } = useAuthStore(state => ({
    login: state.login,
    isLoading: state.isLoading,
    error: state.error,
    clearError: state.clearError,
  }));
  
  const [formData, setFormData] = React.useState({ email: '', password: '' });
  
  const handleLogin = async () => {
    clearError();
    
    try {
      await login({
        email: formData.email,
        password: formData.password,
      });
    } catch (err) {
      // Error is already handled in the store
      console.error('Login failed:', err);
    }
  };

  return (
    <form>
      {error && <div className="error">{error.message}</div>}
      {/* Form fields */}
      <button 
        onClick={handleLogin} 
        disabled={isLoading}
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
};

// =================== THEME MANAGEMENT MIGRATION ===================

// OLD WAY - Theme context
const OldThemeToggle = () => {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

// NEW WAY - UI store
const NewThemeToggle = () => {
  const { theme, toggleTheme } = useUIStore(state => ({
    theme: state.resolvedTheme,
    toggleTheme: state.toggleTheme,
  }));

  return (
    <button onClick={toggleTheme}>
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

// =================== FILE UPLOAD MIGRATION ===================

// OLD WAY - Component state with manual API calls
const OldFileUpload = () => {
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  
  const handleUpload = async (newFiles: File[]) => {
    setUploading(true);
    setProgress(0);
    
    try {
      // Manual upload logic
      const formData = new FormData();
      newFiles.forEach(file => formData.append('files', file));
      
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setFiles(prev => [...prev, ...newFiles]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        multiple 
        onChange={(e) => {
          if (e.target.files) {
            handleUpload(Array.from(e.target.files));
          }
        }}
        disabled={uploading}
      />
      {uploading && (
        <div>
          Uploading... {progress}%
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <div>Files: {files.length}</div>
    </div>
  );
};

// NEW WAY - Document store with automatic progress tracking
const NewFileUpload = () => {
  const { 
    files, 
    isUploading, 
    uploadProgress, 
    addFiles 
  } = useDocumentStore(state => ({
    files: state.files,
    isUploading: state.isUploading,
    uploadProgress: state.uploadProgress,
    addFiles: state.addFiles,
  }));
  
  const handleUpload = async (newFiles: File[]) => {
    try {
      await addFiles(newFiles);
      // Success handling is automatic via store
    } catch (error) {
      console.error('Upload failed:', error);
      // Error handling is automatic via store
    }
  };

  return (
    <div>
      <input 
        type="file" 
        multiple 
        onChange={(e) => {
          if (e.target.files) {
            handleUpload(Array.from(e.target.files));
          }
        }}
        disabled={isUploading}
      />
      {isUploading && (
        <div>
          Uploading... {uploadProgress}%
          <div className="progress-bar">
            <div style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}
      <div>Files: {files.length}</div>
    </div>
  );
};

// =================== TEMPLATE MANAGEMENT MIGRATION ===================

// OLD WAY - Manual CRUD operations
const OldTemplateList = () => {
  const [templates, setTemplates] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const deleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  React.useEffect(() => {
    loadTemplates();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {templates.map(template => (
        <div key={template.id}>
          <span>{template.name}</span>
          <button onClick={() => deleteTemplate(template.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

// NEW WAY - Template store with automatic state management
const NewTemplateList = () => {
  const { 
    templates, 
    loading, 
    error, 
    load, 
    delete: deleteTemplate 
  } = useTemplateStore(state => ({
    templates: state.templates.filter(t => t.isActive),
    loading: state.isLoading,
    error: state.lastError,
    load: state.loadTemplates,
    delete: state.deleteTemplate,
  }));
  
  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {templates.map(template => (
        <div key={template.id}>
          <span>{template.name}</span>
          <button onClick={() => deleteTemplate(template.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
};

// =================== NOTIFICATION MIGRATION ===================

// OLD WAY - Manual toast management
const OldNotifications = () => {
  const [notifications, setNotifications] = React.useState<any[]>([]);
  
  const addNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    const notification = { id, message, type };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };
  
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="notifications">
      {notifications.map(notification => (
        <div key={notification.id} className={`toast ${notification.type}`}>
          {notification.message}
          <button onClick={() => removeNotification(notification.id)}>×</button>
        </div>
      ))}
    </div>
  );
};

// NEW WAY - UI store notifications
const NewNotifications = () => {
  const { 
    notifications, 
    removeNotification, 
    addNotification 
  } = useUIStore(state => ({
    notifications: state.notifications,
    removeNotification: state.removeNotification,
    addNotification: state.addNotification,
  }));
  
  // Example usage
  const showSuccess = () => {
    addNotification({
      type: 'success',
      title: 'Success!',
      message: 'Operation completed successfully',
    });
  };

  return (
    <>
      <button onClick={showSuccess}>Show Success</button>
      
      <div className="notifications">
        {notifications.map(notification => (
          <div key={notification.id} className={`toast ${notification.type}`}>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
            <button onClick={() => removeNotification(notification.id)}>×</button>
          </div>
        ))}
      </div>
    </>
  );
};

// =================== APP INITIALIZATION ===================

// NEW WAY - Initialize all stores
const AppWithStores = () => {
  React.useEffect(() => {
    // Initialize all stores when app starts
    initializeStores().then(() => {
      console.log('✅ All stores initialized');
    }).catch(error => {
      console.error('❌ Store initialization failed:', error);
    });
  }, []);

  return (
    <div>
      <NewThemeToggle />
      <NewFileUpload />
      <NewTemplateList />
      <NewNotifications />
    </div>
  );
};

// =================== CROSS-STORE SELECTORS ===================

const DashboardStats = () => {
  // Example of using combined selectors
  const stats = useAuthStore(state => {
    const user = state.user;
    const jobs = useDocumentStore.getState().jobs;
    const templates = useTemplateStore.getState().templates;
    
    return {
      userName: user?.name || 'Guest',
      totalJobs: jobs.length,
      activeTemplates: templates.filter(t => t.isActive).length,
      successRate: jobs.length > 0 ? 
        (jobs.filter(j => j.status === 'completed').length / jobs.length) * 100 : 0
    };
  });

  return (
    <div className="dashboard-stats">
      <h2>Welcome, {stats.userName}!</h2>
      <div className="stats-grid">
        <div>Total Jobs: {stats.totalJobs}</div>
        <div>Active Templates: {stats.activeTemplates}</div>
        <div>Success Rate: {stats.successRate.toFixed(1)}%</div>
      </div>
    </div>
  );
};

// =================== EXPORT MIGRATION EXAMPLES ===================

export {
  OldLoginForm,
  NewLoginForm,
  OldThemeToggle,
  NewThemeToggle,
  OldFileUpload,
  NewFileUpload,
  OldTemplateList,
  NewTemplateList,
  OldNotifications,
  NewNotifications,
  AppWithStores,
  DashboardStats,
};