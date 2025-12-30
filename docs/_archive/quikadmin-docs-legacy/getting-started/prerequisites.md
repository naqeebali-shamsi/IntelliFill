---
title: Prerequisites
category: getting-started
status: active
last_updated: 2025-11-11
---

# Prerequisites

Before you begin working with QuikAdmin, ensure you have the following prerequisites installed and configured.

## Required Software

### Node.js and npm

- **Node.js**: Version 18.x or higher (LTS recommended)
- **npm**: Version 9.x or higher (comes with Node.js)

**Verification:**

```bash
node --version  # Should show v18.x.x or higher
npm --version   # Should show 9.x.x or higher
```

**Installation:**

- Download from [nodejs.org](https://nodejs.org/)
- Choose the LTS (Long Term Support) version

### Git

- **Git**: Version 2.30 or higher

**Verification:**

```bash
git --version   # Should show 2.30 or higher
```

**Installation:**

- Windows: [git-scm.com](https://git-scm.com/)
- Use Git Bash for command-line operations

### PostgreSQL Client (Optional)

- **PostgreSQL**: Version 14.x or higher (for local development)
- Or use Neon Serverless (cloud-based)

**Verification:**

```bash
psql --version  # Should show 14.x or higher
```

## Required Accounts & Services

### Neon Database

- Free tier available at [neon.tech](https://neon.tech/)
- Provides serverless PostgreSQL
- Required for production and recommended for development

### Supabase (Optional)

- If using Supabase authentication
- Free tier available at [supabase.com](https://supabase.com/)

### Redis (Optional)

- For session management and caching
- Can use local Redis or cloud service (Upstash, Redis Cloud)

## Development Environment

### Code Editor

Recommended: **Visual Studio Code** with extensions:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Prisma

### Terminal

- **Windows**: Git Bash (recommended) or PowerShell
- **macOS/Linux**: Built-in terminal

## System Requirements

### Minimum Requirements

- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 2 GB free space for dependencies
- **OS**: Windows 10/11, macOS 10.15+, or Linux

### Recommended Specifications

- **RAM**: 16 GB for comfortable development
- **CPU**: Multi-core processor (4+ cores)
- **SSD**: For faster npm install and build times

## Network Requirements

### Firewall & Ports

Ensure the following ports are available:

- **3000**: Frontend development server
- **3001**: Backend API server
- **5432**: PostgreSQL (if running locally)
- **6379**: Redis (if running locally)

### Internet Access

Required for:

- Installing npm packages
- Connecting to Neon Database
- Accessing external APIs

## Knowledge Prerequisites

### Required Skills

- Basic JavaScript/TypeScript knowledge
- Understanding of Node.js and npm
- Familiarity with REST APIs
- Basic Git operations

### Helpful Knowledge

- React basics
- PostgreSQL/SQL fundamentals
- Express.js framework
- Prisma ORM

## Next Steps

Once you have all prerequisites ready:

1. **[Installation Guide](./installation.md)** - Set up QuikAdmin
2. **[Windows Setup](./windows-setup.md)** - Windows-specific instructions
3. **[First Run](./first-run.md)** - Start the application
4. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Verification Checklist

Before proceeding with installation, verify:

- [ ] Node.js 18+ installed and in PATH
- [ ] npm 9+ available
- [ ] Git installed and configured
- [ ] Code editor ready (VS Code recommended)
- [ ] Neon account created (or local PostgreSQL ready)
- [ ] Terminal/command line accessible
- [ ] 2+ GB free disk space
- [ ] Internet connection stable

## Getting Help

If you're missing any prerequisites or encounter issues:

- Review the **[Troubleshooting Guide](./troubleshooting.md)**
- Check the **[Architecture Quick Reference](../01-current-state/architecture/quick-reference.md)**
- Consult specific setup guides for your platform

---

**Related Documentation:**

- [Installation Guide](./installation.md)
- [Windows Setup Guide](./windows-setup.md)
- [Development Environment Setup](../development/setup/local-environment.md)
