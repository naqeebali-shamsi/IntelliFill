# Hot Reloading Setup for IntelliFill Backend

## Overview
The backend application is now configured with hot reloading for a better development experience. Changes to TypeScript files will automatically restart the server without manual intervention.

## Quick Start

### Using Docker (Recommended)
```bash
# Start development environment with hot reloading
./scripts/dev-start.sh

# Or manually:
docker compose -f docker-compose.dev.yml up
```

### Local Development (Without Docker)
```bash
# Install dependencies
npm install

# Start with hot reloading
npm run dev

# Alternative with nodemon
npm run dev:nodemon

# With debugging enabled (port 9229)
npm run dev:debug
```

## Available Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start with ts-node-dev hot reloading | Primary development mode |
| `npm run dev:nodemon` | Start with nodemon | Alternative hot reload |
| `npm run dev:debug` | Start with debugging enabled | Connect debugger to port 9229 |
| `npm run dev:worker` | Start queue processor with hot reload | For background job development |

## Features

### 1. **ts-node-dev Integration**
- Watches all files in `src/` directory
- Automatically restarts on changes
- Transpiles TypeScript on the fly
- Faster than full TypeScript compilation

### 2. **Nodemon Configuration**
- Alternative hot reloading option
- Configured via `nodemon.json`
- Watches `.ts`, `.js`, and `.json` files
- 1-second delay to batch rapid changes
- Verbose logging for debugging

### 3. **Docker Development Setup**
- Separate `docker-compose.dev.yml` for development
- Source code mounted as volumes
- Preserves node_modules inside container
- Supports both backend and frontend hot reloading

### 4. **Volume Mounting Strategy**
```yaml
volumes:
  - ./src:/app/src:delegated        # Source code
  - ./package.json:/app/package.json # Package config
  - /app/node_modules                # Use container's node_modules
```

## File Structure
```
quikadmin/
├── docker-compose.dev.yml      # Development Docker config
├── Dockerfile.dev              # Development Dockerfile
├── nodemon.json               # Nodemon configuration
├── .env.development           # Development environment variables
├── scripts/
│   └── dev-start.sh          # Convenient startup script
└── web/
    └── Dockerfile.dev        # Frontend development Dockerfile
```

## Environment Variables

Development environment uses `.env.development`:
- `NODE_ENV=development`
- `LOG_LEVEL=debug`
- `CORS_ORIGIN=http://localhost:3001`

## Debugging

### VS Code Configuration
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Docker",
  "port": 9229,
  "restart": true,
  "localRoot": "${workspaceFolder}",
  "remoteRoot": "/app"
}
```

### Chrome DevTools
1. Start with `npm run dev:debug`
2. Open `chrome://inspect`
3. Click "inspect" under Remote Target

## Performance Tips

1. **Use delegated mounts**: Improves Docker performance on Mac/Windows
2. **Ignore test files**: Configured to ignore `*.spec.ts` and `*.test.ts`
3. **Exclude node_modules**: Prevents watching thousands of files
4. **Batch changes**: 1-second delay groups rapid file saves

## Troubleshooting

### Changes not detected?
- Ensure files are saved
- Check volume mounts: `docker compose -f docker-compose.dev.yml exec app ls -la /app/src`
- Restart containers: `docker compose -f docker-compose.dev.yml restart app`

### Port already in use?
- Stop other services: `docker compose down`
- Check for processes: `lsof -i :3000`

### Slow performance?
- Use delegated mounts (already configured)
- Increase Docker resources
- Consider local development without Docker

## Commands Reference

```bash
# Start development
./scripts/dev-start.sh

# View logs
docker compose -f docker-compose.dev.yml logs -f app

# Restart backend only
docker compose -f docker-compose.dev.yml restart app

# Execute commands in container
docker compose -f docker-compose.dev.yml exec app npm test

# Stop everything
docker compose -f docker-compose.dev.yml down
```

## Next Steps

1. Run `./scripts/dev-start.sh` to start development
2. Edit any file in `src/` directory
3. Watch the server automatically restart
4. Check logs for any compilation errors
5. Happy coding! 🚀