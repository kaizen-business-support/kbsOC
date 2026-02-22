require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Testing Prisma connection...');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to database successfully!');
    
    // Test a simple query
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
    
    // Test creating a user
    const testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });
    
    if (!testUser) {
      const newUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          role: 'ACCOUNT_MANAGER',
          permissions: ['test_permission']
        }
      });
      console.log('✅ Created test user:', newUser.id);
    } else {
      console.log('✅ Test user already exists:', testUser.id);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

testConnection();