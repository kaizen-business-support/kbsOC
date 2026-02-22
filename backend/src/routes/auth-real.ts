import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

const router = express.Router();

// Create PostgreSQL connection pool — credentials from environment only
const pool = new Pool({
  user: process.env.DB_USER || 'optimus',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'optimus_credit',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on('connect', () => {
  logger.info('PostgreSQL pool connected successfully');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  jobTitle?: string;
  permissions: string[];
  lastLogin: Date;
  isActive: boolean;
}

// Generate JWT token
function generateTokens(userId: string): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET || 'default-secret',
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return { accessToken, refreshToken };
}

// Login endpoint
router.post('/login', async (req, res) => {
  let client: PoolClient | undefined;
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get database connection
    client = await pool.connect();

    // Find user by email
    const userQuery = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const userResult = await client.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      logger.warn(`Login attempt with invalid email: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const dbUser = userResult.rows[0];

    // Verify password with bcrypt only
    const isValidPassword = dbUser.password_hash && await bcrypt.compare(password, dbUser.password_hash);

    if (!isValidPassword) {
      logger.warn(`Login attempt with invalid password for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await client.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [dbUser.id]);

    // Generate tokens
    const tokens = generateTokens(dbUser.id);

    // Prepare user response
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      department: dbUser.department,
      jobTitle: dbUser.job_title,
      permissions: dbUser.permissions || [],
      lastLogin: new Date(),
      isActive: dbUser.is_active
    };

    logger.info('User logged in successfully (PostgreSQL)', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });

  } catch (error: any) {
    logger.error('Login error (PostgreSQL):', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    if (client) client.release();
  }
});

// Get current user endpoint
router.get('/me', async (req, res) => {
  let client: PoolClient | undefined;
  
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

    client = await pool.connect();
    const userResult = await client.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const dbUser = userResult.rows[0];
    const user: User = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      department: dbUser.department,
      jobTitle: dbUser.job_title,
      permissions: dbUser.permissions || [],
      lastLogin: new Date(dbUser.last_login),
      isActive: dbUser.is_active
    };

    res.json({
      success: true,
      user
    });

  } catch (error: any) {
    logger.error('Get current user error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    if (client) client.release();
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    logger.info('User logged out (PostgreSQL)');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Connection test endpoint
router.get('/test-connection', async (req, res) => {
  let client: PoolClient | undefined;
  
  try {
    client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) as user_count FROM users');
    
    res.json({
      success: true,
      message: 'Database connection successful',
      userCount: parseInt(result.rows[0].user_count),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Database connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  } finally {
    if (client) client.release();
  }
});

export default router;