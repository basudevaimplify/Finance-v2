import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/postgres";

console.log("DEBUG: DATABASE_URL =", DATABASE_URL.replace(/:[^:@]*@/, ':***@'));

// Validate DATABASE_URL format
if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
  throw new Error('Invalid DATABASE_URL format');
}

// Parse DATABASE_URL to handle special characters properly
function parseConnectionString(connectionString: string) {
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
      family: 4,
      // Add connection pool settings for better reliability
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    };
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error);
    throw new Error('Invalid DATABASE_URL format');
  }
}

// Parse the URL to handle special characters in password
let connectionConfig;
try {
  connectionConfig = parseConnectionString(DATABASE_URL);
  console.log('Connection config:', {
    ...connectionConfig,
    password: '***'
  });
} catch (error) {
  console.error('Invalid DATABASE_URL:', error);
  throw new Error('Failed to parse DATABASE_URL');
}

export const pool = new Pool(connectionConfig);
export const db = drizzle({ client: pool, schema });

// Test connection on startup with better error handling
pool.connect()
  .then(async (client) => {
    console.log('✅ Database connected successfully');

    // Test a simple query to verify permissions
    try {
      await client.query('SELECT NOW() as current_time');
      console.log('📊 Database query test passed');
    } catch (queryError) {
      console.error('❌ Database query test failed:', queryError);
    }

    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
    console.error('Error details:', {
      code: err.code,
      severity: err.severity,
      detail: err.detail
    });
  });
