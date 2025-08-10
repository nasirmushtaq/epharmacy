const mongoose = require('mongoose');

const ClinicSchema = new mongoose.Schema({
  name: String,
  address: String,
  coordinates: {
    latitude: Number,
    longitude: Number,
  }
}, { _id: false });

const TimeSlotSchema = new mongoose.Schema({
  date: { type: Date, required: true }, // day of slots
  slots: [{ from: String, to: String, isBooked: { type: Boolean, default: false }, bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorBooking' } }]
}, { _id: false });

const DoctorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialties: [{ type: String, index: true }],
  clinics: [ClinicSchema],
  schedule: [TimeSlotSchema], // pre-generated slots per date
  fee: { type: Number, default: 500 },
  bio: String,
  experienceYears: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', DoctorSchema); 