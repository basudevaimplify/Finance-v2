import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse DATABASE_URL to handle special characters properly
function parseConnectionString(connectionString) {
  try {
    const url = new URL(connectionString);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      // SSL configuration: only for remote connections
      ssl: isLocal ? false : { rejectUnauthorized: false },
      // Force IPv4 to avoid IPv6 connection issues
      family: 4
    };
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error.message);
    throw new Error('Invalid DATABASE_URL format');
  }
}

console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'));

// Create pool with parsed connection parameters
const connectionConfig = parseConnectionString(process.env.DATABASE_URL);
console.log('Connection config:', {
  ...connectionConfig,
  password: '***'
});

const pool = new Pool(connectionConfig);

async function testConnection() {
  try {
    console.log('🔄 Attempting database connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');

    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result.rows[0].version);

    // Test a simple query to verify permissions
    await client.query('SELECT NOW() as current_time');
    console.log('⏰ Database query test passed');

    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error details:', {
      code: error.code,
      severity: error.severity,
      detail: error.detail
    });
  } finally {
    await pool.end();
  }
}

testConnection();