const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Simple hash for testing - in production use bcrypt
    const password = crypto.createHash('sha256').update('admin123').digest('hex');
    
    const user = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: password,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
        emailVerified: true
      }
    });
    
    console.log('Admin user created:', user.email);
  } catch (error) {
    if (error.code === 'P2002') {
      console.log('Admin user already exists');
    } else {
      console.error('Error creating admin user:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();