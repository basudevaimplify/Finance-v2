/**
 * Local User Creation Script
 * Creates a demo user for local development testing
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function createLocalUser() {
  // Load environment variables
  require('dotenv').config();
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('Make sure you have a .env file with DATABASE_URL configured');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    
    // Check if tables exist
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tenants'
      );
    `);
    
    if (!tablesExist.rows[0].exists) {
      console.error('❌ Database tables not found');
      console.log('Run "npm run db:push" first to create the database schema');
      process.exit(1);
    }

    // Generate UUIDs
    const tenantId = uuidv4();
    const userId = 'demo-user';
    const email = 'test@example.com';
    const password = 'password';
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    console.log('👤 Creating demo tenant...');
    
    // Insert tenant
    await client.query(`
      INSERT INTO tenants (id, company_name, subscription_plan, max_users, created_at) 
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        subscription_plan = EXCLUDED.subscription_plan,
        max_users = EXCLUDED.max_users
    `, [tenantId, 'Demo Company', 'professional', 10]);
    
    console.log('🏢 Creating demo user...');
    
    // Insert user
    await client.query(`
      INSERT INTO users (id, email, password_hash, tenant_id, tenant_role, created_at) 
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        tenant_id = EXCLUDED.tenant_id,
        tenant_role = EXCLUDED.tenant_role
    `, [userId, email, passwordHash, tenantId, 'admin']);
    
    console.log('✅ Demo user created successfully!');
    console.log('');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('🚀 You can now start the application with: npm run dev');
    console.log('🌐 Then visit: http://localhost:5000');
    
  } catch (error) {
    console.error('❌ Error creating demo user:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('');
      console.log('💡 Connection refused. Make sure:');
      console.log('   1. PostgreSQL is running');
      console.log('   2. DATABASE_URL in .env is correct');
      console.log('   3. Database and user exist');
    } else if (error.code === '23505') {
      console.log('');
      console.log('💡 User already exists. You can use the existing credentials:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
if (require.main === module) {
  createLocalUser();
}

module.exports = { createLocalUser };