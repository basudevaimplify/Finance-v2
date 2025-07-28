#!/usr/bin/env node

/**
 * Quick Start Script for Local Development
 * Automates the initial setup process
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 QRT Closure Agent - Quick Start Setup');
console.log('=====================================\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js version 18 or higher is required');
  console.log(`   Current version: ${nodeVersion}`);
  console.log('   Please upgrade Node.js from: https://nodejs.org/');
  process.exit(1);
}

console.log(`✅ Node.js ${nodeVersion} detected`);

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('📝 Creating .env file from template...');
  
  if (fs.existsSync('.env.example')) {
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ .env file created');
    console.log('⚠️  Please edit .env file with your configuration:');
    console.log('   - DATABASE_URL (PostgreSQL connection)');
    console.log('   - OPENAI_API_KEY (required for AI features)');
    console.log('   - SESSION_SECRET (random string)');
    console.log('');
  } else {
    console.log('⚠️  .env.example not found, creating basic .env...');
    const basicEnv = `# QRT Closure Agent Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/qrt_closure_db"
OPENAI_API_KEY="sk-your-openai-api-key-here"
NODE_ENV="development"
PORT=5000
SESSION_SECRET="change-this-to-a-random-string-min-32-chars"
`;
    fs.writeFileSync('.env', basicEnv);
    console.log('✅ Basic .env file created');
  }
}

// Check if dependencies are installed
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    console.log('   Please run "npm install" manually');
    process.exit(1);
  }
} else {
  console.log('✅ Dependencies already installed');
}

// Load environment to check configuration
require('dotenv').config();

const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].includes('your-') || process.env[varName].includes('username:password'));

if (missingVars.length > 0) {
  console.log('⚠️  Configuration required:');
  console.log('   Please edit your .env file and set:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('');
  console.log('📚 See LOCAL_SETUP_GUIDE.md for detailed instructions');
  console.log('');
}

// Check database connectivity
console.log('🔍 Checking database connection...');
try {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });
  
  (async () => {
    try {
      await client.connect();
      console.log('✅ Database connection successful');
      
      // Check if schema exists
      const result = await client.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const tableCount = parseInt(result.rows[0].table_count);
      
      if (tableCount === 0) {
        console.log('📊 Setting up database schema...');
        try {
          execSync('npm run db:push', { stdio: 'inherit' });
          console.log('✅ Database schema created');
        } catch (error) {
          console.log('⚠️  Please run "npm run db:push" to create database schema');
        }
      } else {
        console.log(`✅ Database schema exists (${tableCount} tables)`);
      }
      
      await client.end();
      
      // Create demo user
      console.log('👤 Setting up demo user...');
      try {
        const { createLocalUser } = require('./create_local_user.js');
        await createLocalUser();
      } catch (error) {
        console.log('⚠️  Demo user setup skipped - you can run "node create_local_user.js" later');
      }
      
    } catch (error) {
      console.log('⚠️  Database connection failed');
      console.log('   Please check your DATABASE_URL in .env');
      console.log('   See LOCAL_SETUP_GUIDE.md for database setup instructions');
    }
  })();
  
} catch (error) {
  console.log('⚠️  Database client not available');
  console.log('   Make sure PostgreSQL dependencies are installed');
}

console.log('');
console.log('🎉 Quick start setup complete!');
console.log('');
console.log('Next steps:');
console.log('1. Review and update your .env file');
console.log('2. Ensure your PostgreSQL database is running');
console.log('3. Run: npm run dev');
console.log('4. Visit: http://localhost:5000');
console.log('');
console.log('📚 For detailed setup instructions, see LOCAL_SETUP_GUIDE.md');
console.log('❓ For troubleshooting, check the guide or logs');

setTimeout(() => {
  process.exit(0);
}, 1000);