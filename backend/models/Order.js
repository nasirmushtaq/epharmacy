const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: [true, 'Order number is required']
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  
  // Order type - determines the structure of items
  orderType: {
    type: String,
    enum: ['medicine', 'doctor_booking', 'test_booking'],
    required: [true, 'Order type is required']
  },
  
  // Medicine order items
  items: [{
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine'
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      min: [0, 'Price cannot be negative']
    },
    total: {
      type: Number,
      min: [0, 'Total cannot be negative']
    }
  }],
  
  // Doctor booking details
  doctorBooking: {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    date: Date,
    from: String, // HH:MM format
    to: String,   // HH:MM format
    clinicIndex: Number,
    fee: Number,
    bookingNumber: String,
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled'
    }
  },
  
  // Test booking details
  testBooking: {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test'
    },
    scheduledAt: Date,
    address: {
      line1: { type: String },
      city: { type: String },
      state: { type: String },
      zip: { type: String },
      phone: { type: String }
    },
    bookingNumber: String,
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'assigned', 'sample_collected', 'results_ready', 'completed', 'cancelled'],
      default: 'pending_review'
    },
    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resultFiles: [{
      url: String,
      originalName: String,
      uploadedAt: { type: Date, default: Date.now }
    }]
  },
  
  // Prescription information (for medicine orders)
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  isPrescriptionOrder: {
    type: Boolean,
    default: false
  },
  
  // Pricing
  subtotal: {
    type: Number,
    default: 0,
    min: [0, 'Subtotal cannot be negative']
  },
  deliveryCharges: {
    type: Number,
    default: 0,
    min: [0, 'Delivery charges cannot be negative']
  },
  tax: {
    type: Number,
    default: 0,
    min: [0, 'Tax cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  
  // Delivery address (for medicine orders)
  deliveryAddress: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zipCode: { type: String },
    phone: { type: String },
    location: {
      lat: Number,
      lng: Number
    },
    distanceKm: Number
  },
  
  // Nearest pharmacy assigned for fulfilment (for medicine orders)
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Order status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  // Cancellation details
  cancellation: {
    reason: { type: String },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: { type: Date }
  },
  
  // Enhanced payment information with tracking
  payment: {
    method: {
      type: String,
      enum: ['cash_on_delivery', 'online'],
      required: [true, 'Payment method is required']
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    gateway: {
      type: String,
      enum: ['razorpay', 'cashfree'],
      default: 'cashfree'
    },
    // Payment tracking fields
    gatewayOrderId: String,
    paymentSessionId: String,
    paymentId: String,
    signature: String,
    amount: Number,
    currency: { type: String, default: 'INR' },
    
    // Status change tracking with timestamps
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      source: { type: String, enum: ['user', 'webhook', 'admin'], default: 'user' },
      metadata: mongoose.Schema.Types.Mixed
    }],
    
    // Payment attempts tracking
    attempts: [{
      attemptedAt: { type: Date, default: Date.now },
      gatewayResponse: mongoose.Schema.Types.Mixed,
      status: String,
      error: String
    }],
    
    // Webhook tracking for out-of-order protection
    lastWebhookId: String,
    lastWebhookTimestamp: Date,
    webhookVersion: { type: Number, default: 1 }
  },
  
  // Delivery tracking (for medicine orders)
  delivery: {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: Date,
    deliveredAt: Date
  }
  
}, {
  timestamps: true
});

// Virtual to indicate if order can be cancelled
orderSchema.virtual('canBeCancelled').get(function() {
  // Allow cancellation only when not confirmed/processing/out_for_delivery/delivered/cancelled
  // As per requirement, only allow when placed i.e., pending
  return this.status === 'pending';
});

// Method to cancel an order
orderSchema.methods.cancel = async function(reason, userId) {
  if (!this.status || this.status === 'cancelled') return false;
  if (!this.canBeCancelled) return false;

  this.status = 'cancelled';
  this.cancellation = {
    reason: reason || 'Cancelled by customer',
    cancelledBy: userId || null,
    cancelledAt: new Date()
  };

  // If payment was processing/paid, leave as-is for refund workflows; otherwise mark failed
  if (this.payment && (this.payment.status === 'pending' || this.payment.status === 'processing')) {
    this.payment.status = 'failed';
    this.payment.statusHistory.push({ status: 'failed', source: 'user', metadata: { reason: 'order_cancelled' } });
  }
  await this.save();
  return true;
};

// Generate order number based on type
orderSchema.pre('save', function(next) {
  if (!this.orderNumber) {
    let prefix = 'ORD';
    switch(this.orderType) {
      case 'medicine':
        prefix = 'MED';
        break;
      case 'doctor_booking':
        prefix = 'DOC';
        break;
      case 'test_booking':
        prefix = 'TEST';
        break;
    }
    this.orderNumber = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

// Method to safely update payment status with out-of-order protection
orderSchema.methods.updatePaymentStatus = function(newStatus, source = 'user', metadata = {}, webhookId = null) {
  // Prevent downgrading payment status (except for failed/refunded)
  const statusPriority = {
    'pending': 1,
    'processing': 2,
    'paid': 3,
    'failed': 0,
    'refunded': 0
  };
  
  const currentPriority = statusPriority[this.payment.status] || 0;
  const newPriority = statusPriority[newStatus] || 0;
  
  // Allow status change if:
  // 1. New status has higher priority
  // 2. New status is failed/refunded (can happen anytime)
  // 3. Webhook is newer than last processed
  const canUpdate = newPriority > currentPriority || 
                   newStatus === 'failed' || 
                   newStatus === 'refunded' ||
                   (webhookId && (!this.payment.lastWebhookId || webhookId > this.payment.lastWebhookId));
  
  if (canUpdate) {
    // Record status history
    this.payment.statusHistory.push({
      status: newStatus,
      source,
      metadata
    });
    
    // Update current status
    this.payment.status = newStatus;
    
    // Update webhook tracking if provided
    if (webhookId) {
      this.payment.lastWebhookId = webhookId;
      this.payment.lastWebhookTimestamp = new Date();
    }
    
    return true;
  }
  
  return false;
};

// Method to add payment attempt
orderSchema.methods.addPaymentAttempt = function(gatewayResponse, status, error = null) {
  this.payment.attempts.push({
    gatewayResponse,
    status,
    error
  });
};

// Generate order number if not provided (must be first pre-save hook)
orderSchema.pre('save', function(next) {
  // Generate order number first, before any validation
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `ORD-${timestamp}-${random}`;
    console.log(`[ORDER] Generated order number: ${this.orderNumber}`);
  }
  
  // Then do validation based on order type
  if (this.orderType === 'medicine') {
    if (!this.items || this.items.length === 0) {
      return next(new Error('Medicine orders must have items'));
    }
    if (!this.deliveryAddress || !this.deliveryAddress.street) {
      return next(new Error('Medicine orders must have delivery address'));
    }
  } else if (this.orderType === 'doctor_booking') {
    if (!this.doctorBooking || !this.doctorBooking.doctor) {
      return next(new Error('Doctor booking orders must have doctor booking details'));
    }
  } else if (this.orderType === 'test_booking') {
    if (!this.testBooking || !this.testBooking.test) {
      return next(new Error('Test booking orders must have test booking details'));
    }
    // For test bookings, if address is provided, validate all required fields
    if (this.testBooking.address && (
        this.testBooking.address.line1 || 
        this.testBooking.address.city || 
        this.testBooking.address.state || 
        this.testBooking.address.zip || 
        this.testBooking.address.phone
      )) {
      const addr = this.testBooking.address;
      if (!addr.line1 || !addr.city || !addr.state || !addr.zip || !addr.phone) {
        return next(new Error('Test booking address must include all fields: line1, city, state, zip, and phone'));
      }
    }
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema); 