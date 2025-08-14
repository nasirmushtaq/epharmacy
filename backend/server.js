const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config/config');
const User = require('./models/User');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const medicineRoutes = require('./routes/medicines');
const prescriptionRoutes = require('./routes/prescriptions');
const orderRoutes = require('./routes/orders');
const deliveryRoutes = require('./routes/deliveries');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctors');
const testRoutes = require('./routes/tests');
const paymentRoutes = require('./routes/payments');
const addressRoutes = require('./routes/addresses');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Trust proxy for rate limiting (more secure - only trust localhost for development)
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Connect to MongoDB
mongoose.connect(config.mongodbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB connected successfully');
  await ensureBootstrapAdmin();
})
.catch((err) => console.error('MongoDB connection error:', err));

async function ensureBootstrapAdmin() {
  try {
    const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) {
      return; // not configured
    }

    const firstName = process.env.ADMIN_FIRST || 'Admin';
    const lastName = process.env.ADMIN_LAST || 'User';
    const phone = process.env.ADMIN_PHONE || '+917006861539';
    const address = {
      street: process.env.ADMIN_STREET || 'Bomai',
      city: process.env.ADMIN_CITY || 'Srinagar',
      state: process.env.ADMIN_STATE || 'JK',
      zipCode: process.env.ADMIN_ZIP || '193201',
      country: process.env.ADMIN_COUNTRY || 'India'
    };

    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email,
        password,
        phone,
        role: 'admin',
        address,
        isApproved: true,
        isActive: true,
        isEmailVerified: true
      });
      console.log(`Bootstrap admin created: ${email}`);
      return;
    }

    // Update existing user to admin
    user.firstName = firstName;
    user.lastName = lastName;
    user.phone = phone;
    user.address = address;
    user.role = 'admin';
    user.isApproved = true;
    user.isActive = true;
    user.isEmailVerified = true;
    if (String(process.env.ADMIN_RESET_PASSWORD || '').toLowerCase() === 'true') {
      user.password = password; // will be hashed by pre-save hook
    }
    await user.save();
    console.log(`Bootstrap admin ensured (updated): ${email}`);
  } catch (e) {
    console.error('Failed to bootstrap admin:', e.message);
  }
}

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMin * 60 * 1000,
  max: config.rateLimitMax,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8084',
  'http://localhost:19006',
  ...config.allowedOrigins,
].filter(Boolean));

app.use(cors({
  origin: config.allowAllOrigins
    ? true
    : function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        console.log(`CORS blocked origin: ${origin}`);
        return callback(new Error('Not allowed by CORS'));
      },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Request/response logger (after body parse, before routes)
app.use(requestLogger);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/addresses', addressRoutes);

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = config.port || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} in ${config.env} mode`);
  console.log(`Local: http://localhost:${PORT}`);
  const netIp = config.lanIp || '192.168.0.2';
  console.log(`Network: http://${netIp}:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  console.log('Shutting down the server due to uncaught exception');
  process.exit(1);
});

module.exports = app; 