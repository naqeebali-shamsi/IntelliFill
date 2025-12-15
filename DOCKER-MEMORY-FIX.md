# Docker Memory Configuration Fix

## Overview
Applied memory limits to Docker services to prevent OOM errors and ensure stable E2E test execution.

## Changes Applied

### Fix A: WSL2 Memory Configuration

**File Created**: `N:\IntelliFill\create-wslconfig.ps1`

**To Apply**:
```powershell
# Run this PowerShell script to create .wslconfig
.\create-wslconfig.ps1

# Or manually create C:\Users\naqee\.wslconfig with:
[wsl2]
memory=8GB
processors=4
swap=4GB
localhostForwarding=true
```

**IMPORTANT**: After creating .wslconfig, you MUST restart WSL2:
1. Close Docker Desktop
2. Run: `wsl --shutdown`
3. Start Docker Desktop again

This allocates 8GB RAM to WSL2, preventing Docker from consuming all system memory.

---

### Fix B: Docker Compose Memory Limits

**File Modified**: `N:\IntelliFill\docker-compose.e2e.yml`

**Memory Allocation Per Service**:

| Service | Memory Limit | Memory Reservation | Shared Memory | Notes |
|---------|--------------|-------------------|---------------|-------|
| postgres-test | 512 MB | 256 MB | - | Sufficient for test database with tmpfs |
| redis-test | 256 MB | 128 MB | - | Matches Redis maxmemory config (128MB) |
| backend-test | 2 GB | 1 GB | - | Node.js + Prisma + migrations + seeding |
| frontend-test | 1 GB | 512 MB | - | Vite dev server in test mode |
| playwright | 4 GB | 2 GB | 2 GB | Chromium browsers + 4 parallel workers |

**Total Memory**: ~8 GB (limit), ~4 GB (reservation)

---

## Validation

### Syntax Validation
```bash
docker-compose -f docker-compose.e2e.yml config --quiet
```
**Result**: No errors - configuration is valid

### Memory Limits Verification
```bash
docker-compose -f docker-compose.e2e.yml config | grep -A 3 "mem_limit"
```

**Confirmed Settings** (in bytes):
- postgres-test: 536,870,912 (512 MB) limit, 268,435,456 (256 MB) reservation
- redis-test: 268,435,456 (256 MB) limit, 134,217,728 (128 MB) reservation
- backend-test: 2,147,483,648 (2 GB) limit, 1,073,741,824 (1 GB) reservation
- frontend-test: 1,073,741,824 (1 GB) limit, 536,870,912 (512 MB) reservation
- playwright: 4,294,967,296 (4 GB) limit, 2,147,483,648 (2 GB) reservation + 2 GB shm_size

---

## Benefits

### 1. Prevents OOM Kills
- Memory limits prevent runaway processes from consuming all available RAM
- Reservation ensures minimum memory available during startup

### 2. Predictable Resource Usage
- Total memory footprint is capped at ~8 GB
- Base allocation of ~4 GB guaranteed for core services

### 3. Improved Stability
- Services won't compete for unlimited memory
- WSL2 won't balloon to consume all system RAM

### 4. Better Performance
- Memory reservations ensure services have guaranteed resources
- shm_size for Playwright prevents shared memory issues with Chromium

---

## Next Steps

### 1. Apply WSL2 Configuration
```powershell
# Run the PowerShell script
.\create-wslconfig.ps1

# Restart WSL2
wsl --shutdown
```

### 2. Test E2E Environment
```bash
# Start E2E environment with new memory limits
docker-compose -f docker-compose.e2e.yml up --build --abort-on-container-exit

# Monitor memory usage during tests
docker stats
```

### 3. Monitor & Adjust
Watch for these indicators:
- Services hitting memory limits (will show warnings in docker stats)
- OOM kills (check docker logs)
- Performance degradation (slower startup times)

**If issues occur**, adjust limits in `docker-compose.e2e.yml`:
- Increase limits for services hitting caps
- Decrease limits if total memory usage is too high

---

## Troubleshooting

### WSL2 Still Using Too Much Memory
```powershell
# Verify .wslconfig exists
cat $env:USERPROFILE\.wslconfig

# Confirm WSL2 was restarted
wsl --shutdown
wsl --list --running  # Should show no running distributions
```

### Docker Services Failing to Start
```bash
# Check memory limits aren't too restrictive
docker-compose -f docker-compose.e2e.yml logs [service-name]

# Increase limits if seeing OOM errors
```

### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check if reservations are too high (may cause scheduling issues)
# Reduce reservation if services can't start
```

---

## Files Modified

1. **N:\IntelliFill\create-wslconfig.ps1** (NEW)
   - PowerShell script to create WSL2 memory configuration

2. **N:\IntelliFill\docker-compose.e2e.yml** (MODIFIED)
   - Added mem_limit to all 5 services
   - Added mem_reservation to all 5 services
   - Added shm_size to playwright service

---

## Configuration Details

### Memory Limit (mem_limit)
Hard cap on memory usage. Service will be killed if exceeded.

### Memory Reservation (mem_reservation)
Soft limit that guarantees minimum memory. Docker will try to keep at least this much available.

### Shared Memory (shm_size)
Shared memory size for /dev/shm. Critical for Chromium-based browsers in Playwright.

---

**Created**: 2025-12-13
**Status**: Ready to Apply
**Impact**: Medium (requires WSL2 restart)
