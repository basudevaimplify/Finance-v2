# QRT Closure Agent - Local Development

A sophisticated financial automation platform that processes documents, generates journal entries, and creates compliance reports using AI.

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites
- **Node.js 18+** (download from [nodejs.org](https://nodejs.org/))
- **PostgreSQL** (download from [postgresql.org](https://www.postgresql.org/downloads/))
- **OpenAI API Key** (get from [platform.openai.com](https://platform.openai.com/api-keys))

### 2. Installation

```bash
# Clone/download the project
git clone <repository-url>
cd qrt-closure-agent

# Install dependencies
npm install

# Run quick setup
node quick-start.js
```

### 3. Configuration

Create a `.env` file (or copy from `.env.example`):

```env
# Database (adjust for your setup)
DATABASE_URL="postgresql://username:password@localhost:5432/qrt_closure_db"

# Required: OpenAI API Key
OPENAI_API_KEY="sk-your-actual-openai-key-here"

# Application settings
NODE_ENV="development"
PORT=5000
SESSION_SECRET="your-random-32-char-secret-here"
```

### 4. Database Setup

```bash
# Create PostgreSQL database
createdb qrt_closure_db

# Push schema to database
npm run db:push

# Create demo user
node create_local_user.js
```

### 5. Start Application

```bash
npm run dev
```

Visit **http://localhost:5000** and login with:
- Email: `test@example.com`
- Password: `password`

## 📁 Project Structure

```
qrt-closure-agent/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # App pages
│   │   ├── hooks/         # React hooks
│   │   └── lib/           # Utilities
├── server/                # Express backend
│   ├── routes.ts         # API endpoints
│   ├── services/         # Business logic
│   └── storage.ts        # Database layer
├── shared/               # Shared types
│   └── schema.ts         # Database schema
├── uploads/              # File storage
└── .env                  # Configuration
```

## 🛠️ Development Commands

```bash
# Start development server
npm run dev

# Database operations
npm run db:push        # Update database schema
node create_local_user.js # Create demo user

# Build for production
npm run build
npm start
```

## 🎯 Features

### Core Functionality
- **Document Upload**: CSV, Excel, PDF support
- **AI Classification**: Automatic document type detection
- **Data Extraction**: Structured data from financial documents
- **Journal Generation**: Double-entry accounting entries
- **Financial Reports**: Trial Balance, P&L, Balance Sheet, Cash Flow

### Specialized Reports
- **GSTR-2A/3B**: GST compliance reports
- **Form 26Q**: TDS compliance
- **Bank Reconciliation**: Transaction matching
- **Trial Balance**: Real-time calculations

### AI-Powered Features
- Document classification using OpenAI GPT-4
- Intelligent data extraction and validation
- Automated journal entry generation
- Compliance checking and validation

## 🔧 Configuration Options

### Database Options

**Local PostgreSQL:**
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"
```

**Cloud Databases:**
```env
# Neon (recommended for development)
DATABASE_URL="postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Supabase
DATABASE_URL="postgresql://postgres:pass@db.xyz.supabase.co:5432/postgres"
```

### AI Service Configuration

```env
# Required: OpenAI API Key
OPENAI_API_KEY="sk-your-key"

# Optional: Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-your-key"
```

## 🧪 Testing the Setup

1. **Login**: Use `test@example.com` / `password`
2. **Upload Documents**: Try CSV, Excel, or PDF files
3. **Generate Reports**: Click on Trial Balance, GSTR reports
4. **Download**: Test CSV downloads of generated reports

## 🐛 Troubleshooting

### Database Issues
```bash
# Check if PostgreSQL is running
pg_ctl status

# Test connection
psql -U postgres -d qrt_closure_db

# Reset database
npm run db:push
node create_local_user.js
```

### API Key Issues
- Verify OpenAI API key is valid and has credits
- Test with a simple API call using curl or Postman
- Check for proper formatting (starts with `sk-`)

### Port Conflicts
```bash
# Use different port
PORT=3000 npm run dev

# Kill process on port 5000
lsof -ti:5000 | xargs kill
```

### Common Errors

**"Database connection failed"**
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists

**"OpenAI API error"**
- Check API key is correct
- Ensure account has sufficient credits
- Verify internet connection

**"Module not found"**
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

## 🚀 Next Steps

1. **Upload real financial documents** to test the AI processing
2. **Generate journal entries** and financial reports
3. **Explore compliance features** (GST, TDS reports)
4. **Customize** the system for your specific accounting needs

## 📚 Additional Resources

- **Full Setup Guide**: `LOCAL_SETUP_GUIDE.md`
- **User Manual**: `USER_MANUAL.md`
- **Architecture Guide**: `replit.md`

## 🔒 Security Notes

- Keep your `.env` file secure and never commit API keys
- Use strong passwords for production databases
- Consider using environment-specific configuration for different stages

---

**Need Help?** Check the troubleshooting section above or review the detailed setup guide in `LOCAL_SETUP_GUIDE.md`.