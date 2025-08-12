const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const Doctor = require('../models/Doctor');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  // Purge
  await Promise.all([
    Order.deleteMany({}),
    Medicine.deleteMany({}),
    Doctor.deleteMany({}),
  ]);
  console.log('Purged orders, medicines, doctors');

  // Admin
  const admin = await User.findOneAndUpdate(
    { email: 'admin@example.com' },
    { firstName: 'Super', lastName: 'Admin', role: 'admin', isActive: true, isApproved: true },
    { upsert: true, new: true }
  );

  // Pharmacist
  const pharm = await User.findOneAndUpdate(
    { email: 'pharma@example.com' },
    { firstName: 'Pharma', lastName: 'User', role: 'pharmacist', isActive: true, isApproved: true },
    { upsert: true, new: true }
  );

  // Doctors
  const doctorUser = await User.findOneAndUpdate(
    { email: 'doctor@example.com' },
    { firstName: 'Doc', lastName: 'Tor', role: 'doctor', isActive: true, isApproved: true },
    { upsert: true, new: true }
  );
  const doc = await Doctor.create({
    user: doctorUser._id,
    specialties: ['General Physician'],
    clinics: [{ name: 'City Clinic', city: 'Delhi' }],
    fee: 400,
    bio: 'Experienced physician',
    experienceYears: 10
  });

  // Medicines
  const today = new Date();
  const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

  const meds = await Medicine.insertMany([
    {
      name: 'Paracetamol 500mg',
      genericName: 'Paracetamol',
      brand: 'Cipla',
      category: 'tablets',
      unit: 'tablets',
      dosageForm: 'tablet',
      strength: '500mg',
      packSize: 10,
      manufacturer: 'Cipla',
      sellingPrice: 20,
      mrp: 25,
      stockQuantity: 100,
      minStockLevel: 10,
      batchNumber: 'PARA500-A1',
      manufacturingDate: lastMonth,
      expiryDate: nextYear,
      scheduleType: 'OTC',
      storageInstructions: 'Store in a cool dry place below 25°C',
      usageInstructions: 'Take 1 tablet every 6-8 hours as needed, not exceeding 4g/day',
      composition: [{ ingredient: 'Paracetamol', strength: '500mg', unit: 'mg' }],
      description: 'Pain reliever and fever reducer',
      isPrescriptionRequired: false,
      isActive: true,
      isAvailable: true,
      addedBy: pharm._id
    },
    {
      name: 'Amoxicillin 250mg',
      genericName: 'Amoxicillin',
      brand: 'Sun Pharma',
      category: 'antibiotics',
      unit: 'capsules',
      dosageForm: 'capsule',
      strength: '250mg',
      packSize: 10,
      manufacturer: 'Sun Pharma',
      sellingPrice: 80,
      mrp: 100,
      stockQuantity: 50,
      minStockLevel: 10,
      batchNumber: 'AMOX250-B2',
      manufacturingDate: lastMonth,
      expiryDate: nextYear,
      scheduleType: 'H',
      storageInstructions: 'Store below 25°C, protect from moisture',
      usageInstructions: 'As directed by the physician',
      composition: [{ ingredient: 'Amoxicillin', strength: '250mg', unit: 'mg' }],
      description: 'Antibiotic for bacterial infections',
      isPrescriptionRequired: true,
      isActive: true,
      isAvailable: true,
      addedBy: pharm._id
    }
  ]);

  console.log('Seeded users, doctor, medicines');
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });


