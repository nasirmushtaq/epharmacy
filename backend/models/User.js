const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\+?[\d\s\-\(\)]+$/, 'Please provide a valid phone number']
  },
  role: {
    type: String,
    enum: ['customer', 'pharmacist', 'delivery_agent', 'doctor', 'admin'],
    default: 'customer'
  },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'India' },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    code: String,
    channel: { type: String, enum: ['email', 'phone'] },
    expireAt: Date
  },
  profileImage: {
    type: String,
    default: null
  },
  
  reviewNotes: {
    type: String,
    default: null
  },
  
  // Pharmacist specific fields
  licenseNumber: {
    type: String,
    required: function() { return this.role === 'pharmacist'; }
  },
  licenseExpiry: {
    type: Date,
    required: function() { return this.role === 'pharmacist'; }
  },
  pharmacyName: {
    type: String,
    required: function() { return this.role === 'pharmacist'; }
  },
  
  // Delivery agent specific fields
  vehicleType: {
    type: String,
    enum: ['bike', 'scooter', 'car', 'bicycle'],
    required: function() { return this.role === 'delivery_agent'; }
  },
  vehicleNumber: {
    type: String,
    required: function() { return this.role === 'delivery_agent'; }
  },
  drivingLicense: {
    type: String,
    required: function() { return this.role === 'delivery_agent'; }
  },
  isAvailable: {
    type: Boolean,
    default: function() { return this.role === 'delivery_agent' ? true : undefined; }
  },
  currentLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    lastUpdated: { type: Date }
  },
  
  // Verification tokens
  emailVerificationToken: String,
  emailVerificationExpire: Date,
  passwordResetToken: String,
  passwordResetExpire: Date,
  
  // Tracking
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Index for text search
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      email: this.email,
      role: this.role 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const resetToken = require('crypto').randomBytes(20).toString('hex');
  
  this.emailVerificationToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return resetToken;
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(20).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Static method to find user and increment login attempts
userSchema.statics.getAuthenticated = async function(email, password) {
  const user = await this.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  // Check if user is currently locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    throw new Error('Account temporarily locked due to too many failed login attempts');
  }
  
  const isMatch = await user.comparePassword(password);
  
  if (isMatch) {
    // If login successful and there were previous failed attempts, reset them
    if (user.loginAttempts && user.loginAttempts > 0) {
      await user.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 }
      });
    }
    return user;
  }
  
  // If password is incorrect, increment login attempts
  await user.incLoginAttempts();
  throw new Error('Invalid credentials');
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // If we get to 5 attempts, lock account for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.lockUntil) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema); 