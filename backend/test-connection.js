const { Client } = require('pg');

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'optimus_credit',
    user: 'optimus',
    password: 'OptimusSecure2024'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT version()');
    console.log('Database version:', result.rows[0].version);
    
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    console.log('Number of users:', userCount.rows[0].count);
    
    await client.end();
    console.log('✅ Connection test completed successfully');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();