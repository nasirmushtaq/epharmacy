const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Doctor = require('../models/Doctor');

function toMin(t) { const [h,m] = String(t).split(':').map(Number); return h*60 + m; }
function toStr(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/epharmacy';
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const docs = await Doctor.find({});
    let updated = 0, totalWindows = 0;
    for (const doc of docs) {
      if (!Array.isArray(doc.schedule)) continue;
      const norm = [];
      for (const day of doc.schedule) {
        if (!day?.date) continue;
        const d = new Date(day.date); d.setHours(0,0,0,0);
        const ranges = Array.isArray(day.slots) ? day.slots : [];
        const windowsSet = new Set();
        for (const r of ranges) {
          if (!r?.from || !r?.to) continue;
          const start = toMin(r.from);
          const end = toMin(r.to);
          if (!(end > start)) continue;
          for (let cur = start; cur + 15 <= end; cur += 15) {
            const key = `${toStr(cur)}-${toStr(cur+15)}`;
            windowsSet.add(key);
          }
        }
        const windows = Array.from(windowsSet).sort().map(k => {
          const [from, to] = k.split('-');
          return { from, to };
        });
        if (windows.length) {
          norm.push({ date: d, slots: windows });
          totalWindows += windows.length;
        }
      }
      // Only write if changed
      const before = JSON.stringify((doc.schedule||[]).map(s=>({ date: new Date(s.date).toISOString().slice(0,10), slots: (s.slots||[]).map(x=>({from:x.from,to:x.to})) })));
      const after = JSON.stringify(norm.map(s=>({ date: new Date(s.date).toISOString().slice(0,10), slots: (s.slots||[]).map(x=>({from:x.from,to:x.to})) })));
      if (before !== after) {
        doc.schedule = norm;
        await doc.save();
        updated++;
      }
    }
    console.log(`Normalized schedules. Updated ${updated} doctor(s). Total windows now: ${totalWindows}.`);
  } catch (e) {
    console.error('Normalization failed', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run(); 