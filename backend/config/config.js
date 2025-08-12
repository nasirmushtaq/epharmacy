require('dotenv').config();

const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/epharmacy',

  // CORS
  allowAllOrigins: ['true', '1', 'yes'].includes(String(process.env.CORS_ALLOW_ALL || '').toLowerCase()),
  allowedOrigins: toArray(process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || ''),

  // Rate limiting
  rateLimitWindowMin: parseInt(process.env.RATE_LIMIT_WINDOW || '15', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // Cashfree
  cashfree: {
    env: process.env.CASHFREE_ENV || 'SANDBOX',
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
  },

  // Optional Razorpay (if wired elsewhere)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // OTP
  otp: {
    dummy: process.env.OTP_DUMMY_CODE || '123456',
    ttlMin: parseInt(process.env.OTP_TTL_MIN || '10', 10),
  },

  // Mail (SMTP)
  mail: {
    host: process.env.MAIL_HOST || '',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: ['true','1','yes'].includes(String(process.env.MAIL_SECURE || '').toLowerCase()),
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
    from: process.env.MAIL_FROM || 'no-reply@epharmacy.local'
  },

  // SMS (Twilio optional)
  sms: {
    twilioSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuth: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || ''
  },

  // Networking
  lanIp: process.env.LAN_IP || '',

  // Serviceability: allowed pin codes (comma separated). If empty -> no restriction
  allowedPincodes: toArray(process.env.ALLOWED_PINCODES || ''),
};

module.exports = config;


