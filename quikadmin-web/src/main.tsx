import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Run one-time localStorage migration before app starts
import { migrateAuthStorage } from './utils/migrationUtils';
migrateAuthStorage();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
