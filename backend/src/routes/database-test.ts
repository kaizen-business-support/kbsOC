import express from 'express';
import { Pool } from 'pg';

const router = express.Router();

const pool = new Pool({
  user: process.env.DB_USER || 'optimus',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'optimus_credit',
});

router.get('/test', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Test connection
    const result = await client.query('SELECT version()');
    
    // Test existing tables
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    
    // Test users table
    const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
    
    client.release();
    
    res.json({
      status: 'success',
      message: 'Database connection successful',
      version: result.rows[0].version,
      tables: tablesResult.rows.map(row => row.table_name),
      userCount: parseInt(usersResult.rows[0].user_count)
    });
  } catch (error: any) {
    console.error('Database test failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT id, email, name, role FROM users LIMIT 10');
    client.release();
    
    res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error: any) {
    console.error('Users query failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Users query failed',
      error: error.message
    });
  }
});

export default router;