#!/usr/bin/env node
/**
 * Automated E2E Test Runner
 *
 * This script provides ZERO manual intervention E2E testing:
 * 1. Starts local Redis container (Docker)
 * 2. Seeds test database with E2E users
 * 3. Starts backend service (port 3002) with local Redis
 * 4. Starts frontend service (port 8080)
 * 5. Waits for all services to be ready (health checks)
 * 6. Runs Playwright E2E tests
 * 7. Cleans up (kills processes, stops Redis container)
 *
 * Usage: npm run test:e2e:auto
 *
 * Prerequisites:
 * - Docker installed and running
 * - Node.js 18+
 * - Bun (for frontend)
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Redis configuration for local testing
const REDIS_CONFIG = {
  containerName: 'intellifill-e2e-redis',
  port: 6379,
  url: 'redis://localhost:6379',
};

// Utility: Kill any process using a specific port (Windows-specific)
function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // Find PID using the port
      const result = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      const lines = result.split('\n').filter(line => line.includes('LISTENING'));
      const pids = new Set();

      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      });

      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`  ✓ Killed process ${pid} on port ${port}`);
        } catch (e) {
          // Process may have already exited
        }
      });
    } else {
      // Unix: use lsof
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // No process on port - that's fine
  }
}

// Utility: Clean up ports before starting services
function cleanupPorts() {
  console.log('🧹 Cleaning up ports...');
  killProcessOnPort(3002);
  killProcessOnPort(8080);
  killProcessOnPort(REDIS_CONFIG.port);
  console.log('✅ Ports cleaned up\n');
}

// Utility: Check if Docker is available
function checkDocker() {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

// Utility: Start local Redis container
function startRedis() {
  console.log('🔴 Starting local Redis container...');

  // Check if Docker is available
  if (!checkDocker()) {
    console.error('❌ Docker is not installed or not running');
    console.error('   Please install Docker: https://docs.docker.com/get-docker/');
    process.exit(1);
  }

  // Stop and remove existing container if it exists
  try {
    execSync(`docker stop ${REDIS_CONFIG.containerName}`, { stdio: 'pipe' });
    console.log(`  ✓ Stopped existing Redis container`);
  } catch (e) {
    // Container doesn't exist, that's fine
  }

  try {
    execSync(`docker rm ${REDIS_CONFIG.containerName}`, { stdio: 'pipe' });
  } catch (e) {
    // Container doesn't exist, that's fine
  }

  // Start new Redis container
  try {
    execSync(
      `docker run -d --name ${REDIS_CONFIG.containerName} -p ${REDIS_CONFIG.port}:6379 redis:alpine`,
      { stdio: 'pipe' }
    );
    console.log(`  ✓ Started Redis container on port ${REDIS_CONFIG.port}`);
    console.log(`  ✓ Redis URL: ${REDIS_CONFIG.url}`);
    return true;
  } catch (e) {
    console.error('❌ Failed to start Redis container:', e.message);
    return false;
  }
}

// Utility: Wait for Redis to be ready
async function waitForRedis(timeout = 30000) {
  const startTime = Date.now();
  const interval = 1000;

  console.log('⏳ Waiting for Redis to be ready...');

  while (Date.now() - startTime < timeout) {
    try {
      // Try to ping Redis using docker exec
      execSync(`docker exec ${REDIS_CONFIG.containerName} redis-cli ping`, { stdio: 'pipe' });
      console.log('✅ Redis is ready');
      return true;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  console.error('❌ Redis failed to start within timeout');
  return false;
}

// Utility: Stop Redis container
function stopRedis() {
  console.log('🛑 Stopping Redis container...');
  try {
    execSync(`docker stop ${REDIS_CONFIG.containerName}`, { stdio: 'pipe' });
    execSync(`docker rm ${REDIS_CONFIG.containerName}`, { stdio: 'pipe' });
    console.log('✅ Redis container stopped and removed');
  } catch (e) {
    // Container may not exist
  }
}

// Configuration
const CONFIG = {
  backend: {
    port: 3002,
    healthUrl: 'http://localhost:3002/health',
    cwd: path.resolve(__dirname, '../../quikadmin'),
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev'],
    env: {
      NODE_ENV: 'test', // Test mode enables local JWT auth
      REDIS_URL: REDIS_CONFIG.url, // Override Upstash with local Redis
      E2E_TEST_MODE: 'true',
    },
    readyTimeout: 60000, // 60 seconds
  },
  frontend: {
    port: 8080,
    healthUrl: 'http://localhost:8080',
    cwd: path.resolve(__dirname, '../../quikadmin-web'),
    command: 'bun',
    args: ['run', 'dev'],
    readyTimeout: 60000, // 60 seconds
  },
  tests: {
    cwd: path.resolve(__dirname, '..'),
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    // Exclude performance tests (require full OCR pipeline)
    args: [
      'cross-env', 'E2E_ENV=local', 'playwright', 'test',
      '--project=chromium',
      '--grep-invert', 'Performance',
      '--timeout', '60000',  // 60s max per test
    ],
  },
  seed: {
    cwd: path.resolve(__dirname, '../../quikadmin'),
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['tsx', 'scripts/seed-e2e-users.ts'],
  },
};

let backendProcess = null;
let frontendProcess = null;
let testsFailed = false;

// Utility: Check if service is healthy
function checkHealth(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    }).on('error', () => {
      resolve(false);
    });
  });
}

// Utility: Wait for service to be ready
async function waitForService(name, healthUrl, timeout = 60000) {
  const startTime = Date.now();
  const interval = 2000; // Check every 2 seconds

  console.log(`⏳ Waiting for ${name} to be ready...`);

  while (Date.now() - startTime < timeout) {
    const isHealthy = await checkHealth(healthUrl);
    if (isHealthy) {
      console.log(`✅ ${name} is ready`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  console.error(`❌ ${name} failed to start within ${timeout / 1000}s`);
  return false;
}

// Utility: Spawn process and return handle
function spawnService(name, config) {
  console.log(`🚀 Starting ${name}...`);
  console.log(`   CWD: ${config.cwd}`);
  console.log(`   Command: ${config.command} ${config.args.join(' ')}`);
  if (config.env) {
    console.log(`   Env: ${Object.entries(config.env).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }

  const proc = spawn(config.command, config.args, {
    cwd: config.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env, ...config.env }, // Merge with existing env
  });

  // Capture output for debugging
  proc.stdout.on('data', (data) => {
    const output = data.toString();
    if (process.env.DEBUG === 'true') {
      console.log(`[${name}] ${output}`);
    }
  });

  proc.stderr.on('data', (data) => {
    const output = data.toString();
    // Only show errors, not normal dev server output
    if (output.includes('ERROR') || output.includes('Error')) {
      console.error(`[${name} ERROR] ${output}`);
    }
  });

  proc.on('error', (err) => {
    console.error(`❌ ${name} failed to start:`, err);
  });

  return proc;
}

// Utility: Kill process tree
function killProcess(proc, name) {
  if (!proc || proc.killed) return;

  console.log(`🛑 Stopping ${name}...`);

  try {
    if (process.platform === 'win32') {
      // Windows: Kill entire process tree
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      // Unix: Kill process group
      process.kill(-proc.pid, 'SIGTERM');
    }
    console.log(`✅ ${name} stopped`);
  } catch (err) {
    console.warn(`⚠️  Failed to kill ${name}:`, err.message);
  }
}

// Cleanup on exit
function cleanup() {
  console.log('\n🧹 Cleaning up...');
  killProcess(backendProcess, 'Backend');
  killProcess(frontendProcess, 'Frontend');
  stopRedis();
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted by user');
  cleanup();
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Terminated');
  cleanup();
  process.exit(143);
});

// Main execution flow
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   IntelliFill E2E Automated Test Runner       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // Step 0: Clean up any processes on required ports
  cleanupPorts();

  try {
    // Step 1: Start local Redis
    console.log('🔴 Step 1/6: Starting local Redis (Docker)...');
    const redisStarted = startRedis();
    if (!redisStarted) {
      console.error('❌ Failed to start Redis');
      process.exit(1);
    }

    const redisReady = await waitForRedis();
    if (!redisReady) {
      console.error('❌ Redis failed to become ready');
      cleanup();
      process.exit(1);
    }
    console.log('');

    // Step 2: Seed database
    console.log('📊 Step 2/6: Seeding test database...');
    const seedProcess = spawn(CONFIG.seed.command, CONFIG.seed.args, {
      cwd: CONFIG.seed.cwd,
      stdio: 'inherit',
      shell: true,
    });

    const seedExitCode = await new Promise((resolve) => {
      seedProcess.on('exit', (code) => resolve(code));
    });

    if (seedExitCode !== 0) {
      console.error('❌ Database seeding failed');
      cleanup();
      process.exit(1);
    }
    console.log('✅ Database seeded successfully\n');

    // Step 3: Start backend (with local Redis)
    console.log('🔧 Step 3/6: Starting backend service (with local Redis)...');
    console.log(`   Using REDIS_URL: ${REDIS_CONFIG.url}`);
    backendProcess = spawnService('Backend', CONFIG.backend);
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Give it a moment to start

    const backendReady = await waitForService(
      'Backend',
      CONFIG.backend.healthUrl,
      CONFIG.backend.readyTimeout
    );

    if (!backendReady) {
      console.error('❌ Backend failed to start');
      cleanup();
      process.exit(1);
    }
    console.log('');

    // Step 4: Start frontend
    console.log('🎨 Step 4/6: Starting frontend service...');
    frontendProcess = spawnService('Frontend', CONFIG.frontend);
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Give it a moment to start

    const frontendReady = await waitForService(
      'Frontend',
      CONFIG.frontend.healthUrl,
      CONFIG.frontend.readyTimeout
    );

    if (!frontendReady) {
      console.error('❌ Frontend failed to start');
      cleanup();
      process.exit(1);
    }
    console.log('');

    // Step 5: Wait a bit more for full initialization
    console.log('⏳ Step 5/6: Waiting for services to stabilize...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('✅ Services ready\n');

    // Step 6: Run E2E tests
    console.log('🧪 Step 6/6: Running E2E tests...\n');
    console.log('─'.repeat(60));

    const testProcess = spawn(CONFIG.tests.command, CONFIG.tests.args, {
      cwd: CONFIG.tests.cwd,
      stdio: 'inherit',
      shell: true,
    });

    const testExitCode = await new Promise((resolve) => {
      testProcess.on('exit', (code) => resolve(code));
    });

    console.log('\n' + '─'.repeat(60));

    if (testExitCode !== 0) {
      console.error('\n❌ E2E tests failed');
      testsFailed = true;
    } else {
      console.log('\n✅ All E2E tests passed!');
    }

    // Cleanup
    cleanup();

    // Exit with test status
    process.exit(testExitCode);
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    cleanup();
    process.exit(1);
  }
}

// Run
main();
