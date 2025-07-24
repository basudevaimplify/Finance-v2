#!/bin/bash

# FastAPI AI Service Startup Script
echo "🚀 Starting Finance AI Document Processor..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Set environment variables
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. AI features will be limited."
    echo "   Set it with: export OPENAI_API_KEY='your-api-key'"
else
    echo "✅ OpenAI API key found"
fi

# Start the FastAPI service
echo "🌟 Starting FastAPI service on port 8000..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --log-level info
