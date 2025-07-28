# Local Development Setup Guide

This guide will help you set up the QRT Closure Agent Platform on your local machine for development.

## Prerequisites

Before starting, ensure you have the following installed on your machine:

### Required Software
- **Node.js** (version 18 or higher)
  - Download from: https://nodejs.org/
  - Verify installation: `node --version`
- **PostgreSQL** (version 13 or higher)
  - Download from: https://www.postgresql.org/downloads/
  - Verify installation: `psql --version`
- **Git**
  - Download from: https://git-scm.com/
  - Verify installation: `git --version`

### API Keys Required
- **OpenAI API Key** (for AI-powered document processing)
  - Get from: https://platform.openai.com/api-keys
  - Required for document classification and journal entry generation

## Step 1: Clone and Setup Project

```bash
# Clone the repository (or download the project files)
git clone <your-repository-url>
cd qrt-closure-agent

# Install dependencies
npm install
```

## Step 2: Database Setup

### Option A: Local PostgreSQL Database

1. **Create a new database:**
```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE qrt_closure_db;
CREATE USER qrt_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE qrt_closure_db TO qrt_user;
\q
```

2. **Get your database URL:**
```
postgresql://qrt_user:your_secure_password@localhost:5432/qrt_closure_db
```

### Option B: Cloud Database (Recommended)

Use a cloud PostgreSQL service like:
- **Neon** (https://neon.tech/) - Free tier available
- **Supabase** (https://supabase.com/) - Free tier available
- **Railway** (https://railway.app/) - Free tier available

After creating your database, you'll get a connection URL like:
```
postgresql://username:password@hostname:port/database?sslmode=require
```

## Step 3: Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy the example environment file
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Database Configuration
DATABASE_URL="postgresql://qrt_user:your_secure_password@localhost:5432/qrt_closure_db"

# OpenAI Configuration (Required)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Application Configuration
NODE_ENV="development"
PORT=5000

# Session Secret (generate a random string)
SESSION_SECRET="your-random-session-secret-here"

# Optional: Additional AI Services
ANTHROPIC_API_KEY="your-anthropic-key-here"  # Optional
```

## Step 4: Database Migration

Push the database schema to your PostgreSQL database:

```bash
# Push database schema
npm run db:push

# Verify the migration worked
npm run db:studio  # Opens Drizzle Studio to view database
```

## Step 5: Create Demo User (Optional)

Create a demo user for testing:

```bash
# Run the demo user creation script
node create_test_user.py
```

Or manually create a user by running this SQL in your database:

```sql
-- Insert demo tenant
INSERT INTO tenants (id, company_name, subscription_plan, max_users, created_at) 
VALUES (
  gen_random_uuid(), 
  'Demo Company', 
  'professional', 
  10, 
  NOW()
);

-- Insert demo user (replace tenant_id with the UUID from above)
INSERT INTO users (id, email, password_hash, tenant_id, tenant_role, created_at) 
VALUES (
  'demo-user', 
  'test@example.com', 
  '$2b$10$hash...', -- Use bcrypt to hash 'password'
  'your-tenant-uuid-here',
  'admin',
  NOW()
);
```

## Step 6: Start the Application

```bash
# Start the development server
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5000
- **API**: http://localhost:5000/api

## Step 7: Test the Setup

1. **Open your browser** and navigate to http://localhost:5000
2. **Login** with the demo credentials:
   - Email: `test@example.com`
   - Password: `password`
3. **Upload a test document** to verify the AI processing works
4. **Generate reports** to test the financial automation features

## Local Development Commands

```bash
# Development server (frontend + backend)
npm run dev

# Database operations
npm run db:push        # Push schema changes
npm run db:studio      # Open database management UI
npm run db:migrate     # Run migrations (if using migration files)

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Lint code
npm run lint
```

## Project Structure

```
qrt-closure-agent/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Express backend
│   ├── routes.ts         # API routes
│   ├── services/         # Business logic services
│   └── storage.ts        # Database operations
├── shared/               # Shared types and schemas
│   └── schema.ts         # Database schema definitions
├── uploads/              # File upload directory
└── package.json          # Dependencies and scripts
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify PostgreSQL is running: `pg_ctl status`
   - Check your DATABASE_URL in `.env`
   - Ensure the database exists and user has permissions

2. **OpenAI API Errors**
   - Verify your OPENAI_API_KEY is correct
   - Check your OpenAI account has sufficient credits
   - Ensure the API key has the necessary permissions

3. **Port Already in Use**
   - Change the PORT in `.env` to a different number (e.g., 3000, 8000)
   - Or kill the process using the port: `lsof -ti:5000 | xargs kill`

4. **Missing Dependencies**
   - Delete `node_modules` and `package-lock.json`
   - Run `npm install` again

5. **Database Schema Issues**
   - Run `npm run db:push` to sync the schema
   - Check the database logs for any constraint violations

### Development Tips

1. **Hot Reloading**: The development server automatically reloads when you make changes
2. **Database Viewing**: Use `npm run db:studio` to view and modify database data
3. **API Testing**: Use tools like Postman or curl to test API endpoints
4. **Logs**: Check the console output for detailed error messages and debugging info

## Production Deployment

For production deployment, you'll need to:

1. **Set NODE_ENV to production** in your environment
2. **Use a production database** (not local PostgreSQL)
3. **Set proper security headers** and CORS settings
4. **Use a process manager** like PM2 or deploy to a platform service
5. **Set up proper logging** and monitoring

## Support

If you encounter issues:

1. Check the console logs for error messages
2. Verify all environment variables are set correctly
3. Ensure your database is accessible and properly configured
4. Test your OpenAI API key separately to ensure it works
5. Review the troubleshooting section above

The platform is designed to be self-contained and should work on any system that meets the prerequisites.