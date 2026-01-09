/**
 * Prisma Client Singleton with Enhanced Connection Management
 *
 * Ensures only one PrismaClient instance is created across the application
 * Prevents connection pool exhaustion in development (hot reload)
 * Adds connection retry logic for Neon database
 * Includes keepalive mechanism to prevent Neon idle disconnects
 */

import { PrismaClient } from '@prisma/client';

// Global type declaration for PrismaClient
declare global {
   
  var prisma: PrismaClient | undefined;
   
  var prismaKeepaliveInterval: NodeJS.Timeout | undefined;
}

// Keepalive interval in milliseconds (4 minutes - Neon disconnects after ~5-8 min idle)
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;

// Enhanced Prisma Client with connection retry logic
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
};

// Prevent multiple instances of Prisma Client in development
export const prisma = globalThis.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * Start the keepalive mechanism for Neon database connections
 * Sends a lightweight query every 4 minutes to prevent idle disconnection
 */
export function startKeepalive(): void {
  // Clear any existing interval
  if (globalThis.prismaKeepaliveInterval) {
    clearInterval(globalThis.prismaKeepaliveInterval);
  }

  // Start keepalive ping
  globalThis.prismaKeepaliveInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('🔄 Database keepalive ping successful');
    } catch (error: any) {
      console.warn('⚠️ Database keepalive ping failed:', error.message);
      // Attempt to reconnect
      try {
        await prisma.$connect();
        console.log('✅ Database reconnected after keepalive failure');
      } catch (reconnectError: any) {
        console.error('❌ Database reconnection failed:', reconnectError.message);
      }
    }
  }, KEEPALIVE_INTERVAL_MS);

  console.log(`🔄 Database keepalive started (interval: ${KEEPALIVE_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the keepalive mechanism
 */
export function stopKeepalive(): void {
  if (globalThis.prismaKeepaliveInterval) {
    clearInterval(globalThis.prismaKeepaliveInterval);
    globalThis.prismaKeepaliveInterval = undefined;
    console.log('⏹️ Database keepalive stopped');
  }
}

// Connection health check with retry (increased for Neon cold-start)
export async function ensureDbConnection(maxRetries = 5, delay = 2000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$connect();
      // Test the connection
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✅ Database connection established (attempt ${i + 1})`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Database connection attempt ${i + 1} failed:`, error.message);
      if (i < maxRetries - 1) {
        console.log(`Retrying in ${delay}ms... (Neon database may be waking up)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Exponential backoff (gentler than 2x)
      }
    }
  }
  return false;
}

// Graceful shutdown with error handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Stop keepalive first
  stopKeepalive();
  
  try {
    await prisma.$disconnect();
    console.log('Database disconnected successfully');
  } catch (error) {
    console.error('Error during database disconnection:', error);
  }
  process.exit(0);
};

process.on('beforeExit', async () => {
  stopKeepalive();
  await prisma.$disconnect();
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle connection errors
prisma.$on('error' as never, (error: any) => {
  console.error('Prisma client error:', error);
});
