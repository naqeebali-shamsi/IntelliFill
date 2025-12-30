# Getting Started with QuikAdmin

**Section Number:** 100
**Purpose:** Quick start guides for new developers
**Last Updated:** 2025-01-10

---

## Overview

This section contains everything you need to get QuikAdmin running on your development machine. Whether you're new to the project or setting up a new environment, these guides will help you go from zero to processing your first document in under an hour.

## Documents in This Section

| Document                                         | Description                                        | Difficulty | Status      |
| ------------------------------------------------ | -------------------------------------------------- | ---------- | ----------- |
| [101-installation.md](./101-installation.md)     | Prerequisites and installation steps               | Beginner   | ✅ Complete |
| [104-first-document.md](./104-first-document.md) | 10-minute tutorial: Your first document processing | Beginner   | ✅ Complete |

## Quick Links

**New to QuikAdmin? Start here:**

1. [Installation Guide](./101-installation.md) - Set up your development environment
2. [Your First Document](./104-first-document.md) - Process your first PDF form

**Prerequisites Checklist:**

- [ ] Node.js 20+ installed
- [ ] PostgreSQL 15+ (local or cloud)
- [ ] Redis 6+ (Windows or WSL)
- [ ] nginx for Windows (optional but recommended)

## Related Sections

- [Architecture](../200-architecture/) - Understand the system design
- [API Reference](../300-api/) - Learn about API endpoints
- [Troubleshooting](../400-guides/407-troubleshooting.md) - Common issues and solutions

## Development Environment

QuikAdmin is designed for **Windows native development**. While Docker support exists, we recommend running directly on Windows for better performance and easier debugging.

**Typical Startup:**

```bash
# Terminal 1: Backend
npm run dev  # Port 3002

# Terminal 2: Frontend
cd web && bun run dev  # Port 5173

# Terminal 3: nginx (optional)
nginx  # Port 80
```

## Need Help?

If you encounter issues during setup:

1. Check the [Troubleshooting Guide](../400-guides/407-troubleshooting.md)
2. Review [SETUP_GUIDE_WINDOWS.md](../../SETUP_GUIDE_WINDOWS.md) for Windows-specific issues
3. Consult [CURRENT_ARCHITECTURE.md](../CURRENT_ARCHITECTURE.md) for system understanding

## Contributing

To contribute to this section:

1. Keep guides focused and under 2000 words
2. Include working code examples
3. Test all examples before committing
4. Update this README when adding new documents

---

**Next Step:** Start with [101-installation.md](./101-installation.md) to set up your environment.
