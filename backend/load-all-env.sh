#!/bin/bash

ENV_FILE="$HOME/epharmacy-config/environments.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

echo "📋 Loading ALL environment variables from: $ENV_FILE"

# Load all variables (excluding comments and empty lines)
set -a  # automatically export all variables
source "$ENV_FILE"
set +a  # stop auto-exporting

# Set some defaults
export PORT=8000
export NODE_ENV=development  
export MONGODB_URI="mongodb://localhost:27017/epharmacy"

echo "✅ All environment variables loaded"
echo "🔧 Cashfree check:"
echo "  CASHFREE_APP_ID: ${CASHFREE_APP_ID:-NOT SET}"
echo "  CASHFREE_SECRET_KEY: ${CASHFREE_SECRET_KEY:+SET}" 
echo "  CASHFREE_ENVIRONMENT: ${CASHFREE_ENVIRONMENT:-NOT SET}"

echo ""
echo "🚀 Starting backend server..."
node server.js
