#!/usr/bin/env node
/**
 * Check if Redis is available for security tests
 * Exits 0 if Redis is running, 1 with helpful message if not
 */
const net = require('net');

const REDIS_PORT = 6380;
const REDIS_HOST = 'localhost';
const TIMEOUT_MS = 2000;

const socket = new net.Socket();
let connected = false;

socket.setTimeout(TIMEOUT_MS);

socket.on('connect', () => {
  connected = true;
  socket.destroy();
  console.log('✓ Redis is running on port', REDIS_PORT);
  process.exit(0);
});

socket.on('timeout', () => {
  socket.destroy();
  showError();
});

socket.on('error', () => {
  showError();
});

socket.connect(REDIS_PORT, REDIS_HOST);

function showError() {
  if (connected) return;

  console.error(`
╔═══════════════════════════════════════════════════════════════╗
║  ERROR: Redis not running on port ${REDIS_PORT}                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Security tests require Redis. Quick fix:                     ║
║                                                               ║
║    npm run test:security:setup                                ║
║                                                               ║
║  Or manually:                                                 ║
║                                                               ║
║    docker-compose -f docker-compose.test.yml up -d redis-test ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}
