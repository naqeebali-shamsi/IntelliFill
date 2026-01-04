#!/usr/bin/env node
/**
 * Wait for Redis to be ready (with health check)
 * Used after docker-compose up to ensure Redis accepts connections
 */
const net = require('net');

const REDIS_PORT = 6380;
const REDIS_HOST = 'localhost';
const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 500;

let attempts = 0;

function tryConnect() {
  attempts++;

  const socket = new net.Socket();
  socket.setTimeout(1000);

  socket.on('connect', () => {
    socket.destroy();
    console.log(`✓ Redis is ready on port ${REDIS_PORT} (took ${attempts} attempt(s))`);
    process.exit(0);
  });

  socket.on('error', () => {
    socket.destroy();
    retry();
  });

  socket.on('timeout', () => {
    socket.destroy();
    retry();
  });

  socket.connect(REDIS_PORT, REDIS_HOST);
}

function retry() {
  if (attempts >= MAX_RETRIES) {
    console.error(`✗ Redis not ready after ${MAX_RETRIES} attempts`);
    console.error('  Check: docker-compose -f docker-compose.test.yml logs redis-test');
    process.exit(1);
  }

  process.stdout.write('.');
  setTimeout(tryConnect, RETRY_INTERVAL_MS);
}

console.log('Waiting for Redis...');
tryConnect();
