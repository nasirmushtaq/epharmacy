require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const CITY_LAT = Number(process.env.RANDOM_CITY_LAT || 28.6139); // New Delhi
const CITY_LNG = Number(process.env.RANDOM_CITY_LNG || 77.2090);
const KM_RADIUS = Number(process.env.RANDOM_KM_RADIUS || 8); // random within ~8km

const kmToDeg = (km) => km / 111; // approx

function randomPointAround(lat, lng, kmRadius) {
  const r = kmToDeg(kmRadius) * Math.sqrt(Math.random());
  const t = 2 * Math.PI * Math.random();
  const dx = r * Math.cos(t);
  const dy = r * Math.sin(t);
  // adjust longitude by latitude shrinkage
  const adjLng = dx / Math.cos((lat * Math.PI) / 180);
  return { latitude: lat + dy, longitude: lng + adjLng };
}

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epharmacy';
  await mongoose.connect(uri);

  const users = await User.find({}).select('role email address');
  let updated = 0;
  for (const u of users) {
    if (!u.address) u.address = {};
    if (!u.address.street) u.address.street = 'Auto-generated';
    if (!u.address.city) u.address.city = 'AutoCity';
    if (!u.address.state) u.address.state = 'AutoState';
    if (!u.address.zipCode) u.address.zipCode = '000000';

    const baseLat = CITY_LAT + (u.role === 'pharmacist' ? 0.01 : 0);
    const baseLng = CITY_LNG + (u.role === 'pharmacist' ? 0.01 : 0);
    const p = randomPointAround(baseLat, baseLng, KM_RADIUS);
    u.address.coordinates = { latitude: p.latitude, longitude: p.longitude };
    await u.save();
    updated++;
    if (updated <= 5) console.log(`Set coords for ${u.email}: ${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`);
  }

  console.log(`Random coordinates set for ${updated} users.`);
  await mongoose.disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
