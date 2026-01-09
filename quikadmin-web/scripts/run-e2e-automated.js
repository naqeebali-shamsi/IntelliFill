#!/usr/bin/env node
/**
 * Automated E2E Test Runner
 *
 * This script handles the complete e2e test lifecycle:
 * 1. Seeds test users in Supabase + Prisma
 * 2. Runs Playwright tests (servers are started by playwright.config.ts webServer)
 *
 * Usage:
 *   node scripts/run-e2e-automated.js [playwright-args]
 *   bun run test:e2e:auto
 *   bun run test:e2e:auto -- --project=chromium-xl-1280
 */

const { spawn, execSync } = require('child_process');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// Platform detection
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/**
 * Resolve a binary path with platform-specific extension
 * @param {string} binName - Binary name without extension
 * @returns {string} Full path to binary
 */
function resolveBinary(binName) {
  const extension = isWindows ? '.cmd' : '';
  const binPath = path.resolve(__dirname, `../node_modules/.bin/${binName}${extension}`);
  return binPath;
}

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logStep(step, message) {
  log(`\n[${'='.repeat(60)}]`, COLORS.cyan);
  log(`[STEP ${step}] ${message}`, COLORS.bright + COLORS.cyan);
  log(`[${'='.repeat(60)}]\n`, COLORS.cyan);
}

async function ensureRedisRunning() {
  logStep(1, 'Ensuring Redis is running...');

  return new Promise((resolve) => {
    // Check if Redis is already running
    const checkProcess = spawn('docker', ['ps', '--filter', 'name=redis-e2e', '--format', '{{.Names}}'], {
      shell: true,
      stdio: 'pipe',
    });

    let output = '';
    checkProcess.stdout.on('data', (data) => { output += data.toString(); });

    checkProcess.on('close', (code) => {
      if (output.includes('redis-e2e')) {
        log('Redis container already running', COLORS.green);
        resolve();
        return;
      }

      log('Starting Redis container...', COLORS.yellow);
      const startProcess = spawn(
        'docker',
        ['run', '-d', '--name', 'redis-e2e', '-p', '6379:6379', '--rm', 'redis:alpine'],
        { shell: true, stdio: 'inherit' }
      );

      startProcess.on('close', (startCode) => {
        if (startCode === 0) {
          log('Redis started successfully', COLORS.green);
          // Wait a moment for Redis to be ready
          setTimeout(resolve, 1000);
        } else {
          log('Warning: Could not start Redis (may already exist)', COLORS.yellow);
          // Try to start existing container
          spawn('docker', ['start', 'redis-e2e'], { shell: true, stdio: 'inherit' })
            .on('close', () => {
              setTimeout(resolve, 1000);
            });
        }
      });
    });
  });
}

async function seedTestUsers() {
  logStep(2, 'Seeding E2E test users...');

  return new Promise((resolve, reject) => {
    // Use direct ts-node binary call to avoid npx path issues in monorepo
    const seedProcess = spawn(
      'node',
      [
        '-r', 'dotenv/config',
        './node_modules/ts-node/dist/bin.js',
        'scripts/seed-e2e-users.ts'
      ],
      {
        cwd: path.resolve(__dirname, '../../quikadmin'),
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' },
      }
    );

    seedProcess.on('close', (code) => {
      if (code === 0) {
        log('\nTest users seeded successfully!', COLORS.green);
        resolve();
      } else {
        log(`\nSeeding failed with code ${code}`, COLORS.red);
        reject(new Error(`Seed process exited with code ${code}`));
      }
    });

    seedProcess.on('error', (err) => {
      log(`\nSeeding error: ${err.message}`, COLORS.red);
      reject(err);
    });
  });
}

async function clearAuthState() {
  logStep(3, 'Clearing cached auth states...');

  const authDir = path.resolve(__dirname, '../e2e/.auth');
  try {
    const fs = require('fs');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
      log('Cleared auth state directory', COLORS.green);
    } else {
      log('No cached auth states to clear', COLORS.yellow);
    }
  } catch (err) {
    log(`Warning: Could not clear auth states: ${err.message}`, COLORS.yellow);
  }
}

async function runPlaywrightTests(extraArgs = []) {
  logStep(4, 'Running Playwright E2E tests...');

  log(`Platform: ${process.platform} (Windows: ${isWindows})`, COLORS.cyan);
  log('Playwright will automatically start frontend & backend servers.', COLORS.cyan);
  log('This may take a minute on first run...\n', COLORS.cyan);

  return new Promise((resolve, reject) => {
    const playwrightCli = resolveBinary('playwright');
    const args = ['test', ...extraArgs];

    log(`Resolved playwright CLI: ${playwrightCli}`, COLORS.cyan);

    const testProcess = spawn(playwrightCli, args, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: isWindows,  // Only use shell on Windows for .cmd execution
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('\nAll E2E tests passed!', COLORS.green);
        resolve();
      } else {
        log(`\nE2E tests failed with code ${code}`, COLORS.red);
        reject(new Error(`Tests exited with code ${code}`));
      }
    });

    testProcess.on('error', (err) => {
      log(`\nTest error: ${err.message}`, COLORS.red);
      if (isWindows && err.message.includes('ENOENT')) {
        log('Windows hint: Ensure Node.js and npm are in your PATH', COLORS.yellow);
        log(`Tried to run: ${playwrightCli}`, COLORS.yellow);
      }
      reject(err);
    });
  });
}

async function main() {
  const startTime = Date.now();

  log('\n' + '='.repeat(70), COLORS.cyan);
  log('  INTELLIFILL E2E AUTOMATED TEST RUNNER', COLORS.bright + COLORS.cyan);
  log('='.repeat(70) + '\n', COLORS.cyan);
  log(`Platform: ${process.platform}`, COLORS.cyan);

  // Get extra args to pass to Playwright (everything after --)
  const playwrightArgs = process.argv.slice(2);

  try {
    // Step 1: Ensure Redis is running (required for queues)
    await ensureRedisRunning();

    // Step 2: Seed test users
    await seedTestUsers();

    // Step 3: Clear cached auth states
    await clearAuthState();

    // Step 4: Run Playwright tests
    await runPlaywrightTests(playwrightArgs);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\nTotal time: ${elapsed}s`, COLORS.green);
    process.exit(0);
  } catch (error) {
    log(`\nE2E automation failed: ${error.message}`, COLORS.red);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`\nTotal time: ${elapsed}s`, COLORS.yellow);
    process.exit(1);
  }
}

main();
