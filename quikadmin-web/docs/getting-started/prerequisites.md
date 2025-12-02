# Prerequisites

Before you begin working with QuikAdmin Web, ensure your development environment meets the following requirements.

## System Requirements

### Operating Systems
- **macOS**: 10.15 (Catalina) or later
- **Windows**: 10 or later
- **Linux**: Ubuntu 20.04+ or equivalent

### Hardware
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space for dependencies and build artifacts
- **Processor**: Modern multi-core processor (4+ cores recommended)

## Required Software

### Node.js & Package Manager
You'll need one of the following:

#### Bun (Recommended)
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version
```

**Why Bun?**
- Significantly faster than npm/yarn
- Built-in TypeScript support
- Compatible with Node.js ecosystem
- Excellent performance for dev server

#### Node.js (Alternative)
If you prefer Node.js:
```bash
# Node.js 18+ required
node --version  # Should be 18.0.0 or higher

# npm comes with Node.js
npm --version   # Should be 9.0.0 or higher
```

### Git
```bash
# Install Git
# macOS: comes pre-installed or via Homebrew
brew install git

# Windows: Download from git-scm.com
# Linux (Ubuntu/Debian)
sudo apt-get install git

# Verify installation
git --version
```

### Code Editor

#### VS Code (Recommended)
Download from [code.visualstudio.com](https://code.visualstudio.com/)

**Recommended Extensions:**
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)
- Auto Rename Tag
- Path Intellisense
- GitLens

#### Alternative Editors
- WebStorm
- Sublime Text with TypeScript plugin
- Vim/Neovim with appropriate plugins

## Optional Tools

### Browser Extensions
For development and debugging:

**Chrome/Edge:**
- React Developer Tools
- Redux DevTools (for Zustand debugging)
- Lighthouse (performance auditing)

**Firefox:**
- React Developer Tools
- Redux DevTools

### Database Tools
For backend integration:
- PostgreSQL client (pgAdmin, DBeaver, or Postico)
- Supabase Studio (web interface)

### API Testing
- Postman
- Insomnia
- cURL (command-line)

## Backend Requirements

QuikAdmin Web requires a running backend API:

### QuikAdmin Backend
- Elixir/Phoenix backend server
- PostgreSQL database
- See [QuikAdmin Backend Docs](../../../quikadmin/docs/README.md) for setup

### Supabase (Alternative)
- Supabase project (free tier available)
- Sign up at [supabase.com](https://supabase.com)

## Environment Setup

### Command Line Tools

**macOS/Linux:**
```bash
# Install Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install common tools
brew install git node bun
```

**Windows:**
```powershell
# Install Chocolatey
# Then install tools
choco install git nodejs bun
```

### Terminal Setup

**Recommended terminals:**
- macOS: iTerm2
- Windows: Windows Terminal
- Linux: GNOME Terminal, Konsole

**Shell:**
- Bash (default)
- Zsh (recommended for macOS)
- Fish shell
- PowerShell (Windows)

## Network Requirements

### Ports
Ensure these ports are available:
- **5173**: Vite dev server (default)
- **3000**: Backend API (if running locally)
- **5432**: PostgreSQL (if running locally)

### Firewall
- Allow outbound HTTPS for package installation
- Allow localhost connections for dev server

## Verification Checklist

Before proceeding to installation, verify:

- [ ] Node.js 18+ or Bun installed
- [ ] Git installed and configured
- [ ] Code editor installed with extensions
- [ ] Terminal/command line access
- [ ] Ports 5173 and 3000 available
- [ ] Internet connection for package downloads
- [ ] Backend API access (local or remote)

## Next Steps

Once you've met all prerequisites:
1. Proceed to [Installation Guide](./installation.md)
2. Set up your [Development Environment](./development-server.md)
3. Explore the [Project Structure](./project-structure.md)

## Troubleshooting

### Node.js Version Issues
```bash
# Check current version
node --version

# Use nvm to manage Node versions
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 18
nvm install 18
nvm use 18
```

### Bun Installation Issues
```bash
# If Bun fails to install, use npm instead
# The project works with both

# Verify Bun installation
bun --version

# If issues persist, fallback to npm
npm install
npm run dev
```

### Permission Errors
```bash
# macOS/Linux: Fix npm permissions
sudo chown -R $USER:$(id -gn $USER) ~/.npm
sudo chown -R $USER:$(id -gn $USER) ~/.config

# Or use a Node version manager (recommended)
```

### Git Configuration
```bash
# Set up Git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify configuration
git config --list
```

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Bun Documentation](https://bun.sh/docs)
- [Git Documentation](https://git-scm.com/doc)
- [VS Code Documentation](https://code.visualstudio.com/docs)

---

[Back to Getting Started](./README.md) | [Next: Installation](./installation.md)
