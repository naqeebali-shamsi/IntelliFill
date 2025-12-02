# Installation Guide

This guide walks you through installing and setting up QuikAdmin Web on your local development machine.

## Prerequisites

Before installing, ensure you've completed the [Prerequisites](./prerequisites.md) guide.

## Quick Installation

```bash
# Clone the repository
git clone https://github.com/your-org/quikadmin-web.git
cd quikadmin-web

# Install dependencies (using Bun - recommended)
bun install

# Or using npm
npm install

# Copy environment template
cp .env.example .env

# Start development server
bun run dev
```

## Detailed Installation Steps

### 1. Clone the Repository

```bash
# Using HTTPS
git clone https://github.com/your-org/quikadmin-web.git

# Or using SSH (if configured)
git clone git@github.com:your-org/quikadmin-web.git

# Navigate to project directory
cd quikadmin-web
```

### 2. Install Dependencies

#### Using Bun (Recommended)
```bash
bun install
```

Benefits:
- 10-100x faster than npm
- Better dependency resolution
- Built-in TypeScript support

#### Using npm
```bash
npm install
```

**Expected output:**
```
added 1234 packages in 45s
```

#### Using yarn
```bash
yarn install
```

### 3. Configure Environment Variables

Create your environment configuration:

```bash
# Copy the example file
cp .env.example .env

# Edit the file with your settings
# Use your preferred editor
code .env  # VS Code
nano .env  # Terminal editor
```

**Required Variables:**

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api

# Supabase Configuration (if using Supabase)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

See [Environment Variables Guide](../reference/configuration/environment-variables.md) for detailed configuration.

### 4. Verify Installation

```bash
# Check installed packages
bun run --version  # or npm --version

# Verify dependencies
bun run typecheck  # Should complete without errors

# Run tests
bun run test       # Should pass all tests
```

## Project Structure

After installation, your project structure should look like:

```
quikadmin-web/
├── node_modules/       # Dependencies (generated)
├── public/            # Static assets
├── src/               # Source code
│   ├── components/    # React components
│   ├── pages/         # Page components
│   ├── stores/        # Zustand stores
│   ├── hooks/         # Custom hooks
│   ├── services/      # API services
│   ├── utils/         # Utilities
│   └── types/         # TypeScript types
├── cypress/           # E2E tests
├── tests/             # Unit tests
├── dist/              # Build output (generated)
├── docs/              # Documentation
├── .env               # Environment config (you create this)
├── .env.example       # Environment template
├── package.json       # Dependencies
├── tsconfig.json      # TypeScript config
├── vite.config.ts     # Vite config
└── tailwind.config.js # Tailwind config
```

## Configuration Files

### TypeScript Configuration
The project uses strict TypeScript:
- `tsconfig.json` - Main TypeScript configuration
- `tsconfig.node.json` - Node.js specific configuration

### Build Configuration
- `vite.config.ts` - Vite build tool configuration
- `tailwind.config.js` - TailwindCSS configuration
- `postcss.config.js` - PostCSS configuration

### Testing Configuration
- `vitest.config.ts` - Vitest unit test configuration
- `cypress.config.ts` - Cypress E2E test configuration

## Backend Setup

QuikAdmin Web requires a backend API. You have two options:

### Option 1: Local Backend (Recommended for Development)

```bash
# In a separate terminal, navigate to backend directory
cd ../quikadmin

# Follow backend installation guide
# See: ../quikadmin/docs/installation.md

# Start backend server
mix phx.server  # or your backend start command

# Backend should be running on http://localhost:3000
```

### Option 2: Remote Backend

Update your `.env` to point to a remote API:

```env
VITE_API_URL=https://api.your-domain.com/api
```

### Option 3: Supabase

For Supabase-based development:

```bash
# Sign up at supabase.com
# Create a new project
# Get your project URL and anon key
# Update .env with your credentials
```

## Verify Backend Connection

```bash
# Start the dev server
bun run dev

# In browser, open http://localhost:5173
# Check browser console for API connection status
# Should see "API connected" or similar message
```

## Common Installation Issues

### Port Already in Use

```bash
# Error: Port 5173 is already in use

# Solution 1: Kill process on port 5173
# macOS/Linux:
lsof -ti:5173 | xargs kill -9

# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Solution 2: Use different port
# Edit vite.config.ts:
server: {
  port: 3001  // Change to available port
}
```

### Dependency Installation Failures

```bash
# Clear cache and reinstall
rm -rf node_modules
rm bun.lockb  # or package-lock.json, yarn.lock

# Reinstall
bun install --force

# Or with npm
npm install --force
```

### TypeScript Errors

```bash
# Regenerate TypeScript cache
rm -rf node_modules/.vite

# Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Check TypeScript version
bunx tsc --version
```

### Environment Variable Not Loading

```bash
# Ensure file is named exactly .env (not .env.txt)
ls -la | grep .env

# Restart dev server after .env changes
# Ctrl+C to stop, then:
bun run dev
```

## Development Tools Setup

### VS Code Extensions

Install recommended extensions:

```bash
# Open VS Code
code .

# Install extensions (VS Code will prompt)
# Or install manually:
# - ESLint
# - Prettier
# - Tailwind CSS IntelliSense
# - TypeScript Vue Plugin
```

### Browser Extensions

Install React DevTools:
- [Chrome](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/react-devtools/)

### Git Configuration

```bash
# Configure Git hooks (if available)
git config core.hooksPath .githooks

# Set up commit message template
git config commit.template .gitmessage
```

## Optional Setup

### Prettier Configuration

```bash
# Auto-format on save (VS Code)
# Add to .vscode/settings.json:
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### ESLint Setup

```bash
# Run ESLint
bun run lint  # If lint script exists

# Auto-fix issues
bun run lint --fix
```

### Husky Git Hooks

```bash
# Install Husky (if configured)
bunx husky install

# Commits will now run pre-commit checks
```

## Verification Checklist

Before proceeding, verify:

- [ ] Dependencies installed without errors
- [ ] `.env` file created and configured
- [ ] TypeScript check passes (`bun run typecheck`)
- [ ] Tests pass (`bun run test`)
- [ ] Dev server starts (`bun run dev`)
- [ ] Application loads in browser (http://localhost:5173)
- [ ] Backend API connection working
- [ ] No console errors in browser
- [ ] Hot module replacement (HMR) working

## Next Steps

Now that installation is complete:

1. [Start the Development Server](./development-server.md)
2. [Explore the Project Structure](./project-structure.md)
3. [Learn about Components](../guides/components/README.md)
4. [Understand State Management](../guides/state-management/zustand-basics.md)

## Getting Help

If you encounter issues:

1. Check [Troubleshooting Guide](../reference/troubleshooting/README.md)
2. Review [Common Issues](../reference/troubleshooting/README.md#common-issues)
3. Check existing GitHub issues
4. Ask in team chat or create a new issue

## Additional Resources

- [Vite Documentation](https://vitejs.dev/guide/)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)

---

[Back to Getting Started](./README.md) | [Previous: Prerequisites](./prerequisites.md) | [Next: Development Server](./development-server.md)
