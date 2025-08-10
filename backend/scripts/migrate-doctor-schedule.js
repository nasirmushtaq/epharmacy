const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Doctor = require('../models/Doctor');

function toDateOnly(dateLike) {
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return null;
  d.setHours(0,0,0,0);
  return d;
}

function isValidTime(t) {
  return /^\d{2}:\d{2}$/.test(t);
}

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/epharmacy';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const docs = await Doctor.find({});
    let updated = 0;
    for (const doc of docs) {
      let changed = false;

      // Ensure clinics array
      if (!Array.isArray(doc.clinics) || doc.clinics.length === 0) {
        doc.clinics = [{ name: 'Default Clinic', address: '', coordinates: {} }];
        changed = true;
      }

      // Normalize schedule
      if (Array.isArray(doc.schedule)) {
        const newSchedule = [];
        for (const day of doc.schedule) {
          const normDate = toDateOnly(day?.date);
          if (!normDate) continue;
          const slots = Array.isArray(day?.slots) ? day.slots : [];
          const normSlots = slots
            .filter(s => isValidTime(s?.from) && isValidTime(s?.to))
            .map(s => ({ from: s.from, to: s.to })) // drop isBooked/bookingId
            .filter(s => s.from !== s.to);
          if (normSlots.length) {
            newSchedule.push({ date: normDate, slots: normSlots });
          }
        }
        // Sort by date ascending
        newSchedule.sort((a,b) => a.date - b.date);
        // Assign if different
        if (JSON.stringify(newSchedule) !== JSON.stringify(doc.schedule.map(d=>({ date: new Date(d.date).setHours(0,0,0,0), slots: (d.slots||[]).map(s=>({from:s.from,to:s.to})) })))) {
          doc.schedule = newSchedule;
          changed = true;
        }
      }

      if (changed) { await doc.save(); updated++; }
    }
    console.log(`Migration complete. Updated ${updated} doctor record(s).`);
  } catch (e) {
    console.error('Migration failed', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run(); 