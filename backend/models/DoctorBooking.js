const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  url: String,
  originalName: String,
  mimetype: String,
  size: Number,
}, { _id: false });

const DoctorBookingSchema = new mongoose.Schema({
  bookingNumber: { type: String, required: true, unique: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  clinicIndex: { type: Number, default: 0 },
  date: { type: Date, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  status: { type: String, enum: ['pending','confirmed','cancelled','completed'], default: 'pending' },
  notes: String,
  fee: Number,
  prescriptionFiles: [FileSchema]
}, { timestamps: true });

module.exports = mongoose.model('DoctorBooking', DoctorBookingSchema); 