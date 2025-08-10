require('dotenv').config();
const mongoose = require('mongoose');
const Test = require('../models/Test');

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epharmacy';
  await mongoose.connect(uri);
  const samples = [
    { name: 'Complete Blood Count', code: 'CBC', price: 350, description: 'CBC test', sampleType: 'blood', turnaroundTimeHours: 24 },
    { name: 'Liver Function Test', code: 'LFT', price: 800, description: 'LFT profile', sampleType: 'blood', turnaroundTimeHours: 36 },
    { name: 'RT-PCR COVID', code: 'RTPCR', price: 1200, description: 'COVID-19 RT-PCR', sampleType: 'swab', turnaroundTimeHours: 24 },
    { name: 'Kidney Function Test', code: 'KFT', price: 700, description: 'Renal profile', sampleType: 'blood', turnaroundTimeHours: 24 },
  ];

  for (const s of samples) {
    await Test.updateOne({ code: s.code }, { $set: s }, { upsert: true });
  }
  const count = await Test.countDocuments({ code: { $in: samples.map(s => s.code) } });
  console.log('Seeded/updated tests:', count);
  await mongoose.disconnect();
})();
