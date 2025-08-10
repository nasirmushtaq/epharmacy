const mongoose = require('mongoose');

const TestBookingSchema = new mongoose.Schema({
  bookingNumber: { type: String, required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  test: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  scheduledAt: { type: Date, required: false },
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    zip: String,
    phone: String,
  },
  status: { 
    type: String, 
    enum: ['pending_review','approved','rejected','assigned','in_progress','completed'], 
    default: 'pending_review' 
  },
  reviewNotes: { type: String, default: '' },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resultFiles: [{
    url: String,
    originalName: String,
    mimetype: String,
    size: Number,
  }],
}, { timestamps: true });

module.exports = mongoose.model('TestBooking', TestBookingSchema); 