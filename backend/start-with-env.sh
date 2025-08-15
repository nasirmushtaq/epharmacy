#!/bin/bash

# Load environment variables from environments.local file
ENV_FILE="$HOME/epharmacy-config/environments.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    exit 1
fi

echo "📋 Loading environment variables from: $ENV_FILE"

# Export AWS S3 configuration
export AWS_ACCESS_KEY_ID=$(grep "^AWS_ACCESS_KEY_ID=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_SECRET_ACCESS_KEY=$(grep "^AWS_SECRET_ACCESS_KEY=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_REGION=$(grep "^AWS_REGION=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_S3_BUCKET_NAME="epharmacy-prescriptions-790813558024"

# Export other backend variables
export PORT=8000
export NODE_ENV=development
export MONGODB_URI="mongodb://localhost:27017/epharmacy"
export JWT_SECRET=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2)
export OTP_DUMMY_CODE=$(grep "^OTP_DUMMY_CODE=" "$ENV_FILE" | cut -d'=' -f2)
export BACKEND_URL="http://localhost:8000"

# Export Cashfree configuration
export CASHFREE_APP_ID=$(grep "^CASHFREE_APP_ID=" "$ENV_FILE" | cut -d'=' -f2)
export CASHFREE_SECRET_KEY=$(grep "^CASHFREE_SECRET_KEY=" "$ENV_FILE" | cut -d'=' -f2)
export CASHFREE_ENV=$(grep "^CASHFREE_ENVIRONMENT=" "$ENV_FILE" | cut -d'=' -f2)

# Export email configuration
export RESEND_API_KEY=$(grep "^RESEND_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
export EMAIL_FROM=$(grep "^EMAIL_FROM=" "$ENV_FILE" | cut -d'=' -f2)
export GMAIL_USER=$(grep "^GMAIL_USER=" "$ENV_FILE" | cut -d'=' -f2)
export GMAIL_APP_PASSWORD=$(grep "^GMAIL_APP_PASSWORD=" "$ENV_FILE" | cut -d'=' -f2)

# Export AWS S3 configuration
export AWS_ACCESS_KEY_ID=$(grep "^AWS_ACCESS_KEY_ID=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_SECRET_ACCESS_KEY=$(grep "^AWS_SECRET_ACCESS_KEY=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_S3_BUCKET_NAME=$(grep "^AWS_S3_BUCKET_NAME=" "$ENV_FILE" | cut -d'=' -f2)
export AWS_REGION=$(grep "^AWS_REGION=" "$ENV_FILE" | cut -d'=' -f2)

echo "✅ Environment variables loaded"
echo ""

echo "🚀 Starting backend server..."
npm start
