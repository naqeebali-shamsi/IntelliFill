import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'IntelliFill - Smart Form Autofill',
    description:
      'Automatically fill forms using your stored profile data from documents you have uploaded',
    version: '2.0.0',
    permissions: ['storage', 'alarms'],
    host_permissions: [
      'https://app.intellifill.com/api/*',
      'http://localhost:3002/api/*',
    ],
    icons: {
      '16': 'icons/icon-16.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  runner: {
    startUrls: ['https://example.com'],
  },
});
