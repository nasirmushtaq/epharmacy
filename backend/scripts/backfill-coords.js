require('dotenv').config();
const mongoose = require('mongoose');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const User = require('../models/User');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY || process.env.GOOGLE_API_KEY || process.env.GEOCODE_KEY;

const delay = (ms)=> new Promise(r=>setTimeout(r, ms));

const geocodeAddress = async (address) => {
  if (!GOOGLE_KEY) return null;
  const parts = [address.street, address.city, address.state, address.zipCode, address.country || 'India'].filter(Boolean).join(', ');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(parts)}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  const loc = json?.results?.[0]?.geometry?.location;
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { latitude: loc.lat, longitude: loc.lng };
  }
  return null;
};

(async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/epharmacy';
  await mongoose.connect(uri);

  const users = await User.find({ $or: [
    { 'address.coordinates.latitude': { $exists: false } },
    { 'address.coordinates.longitude': { $exists: false } },
  ]}).limit(200);

  console.log(`Found ${users.length} users missing coordinates`);
  let updated = 0;
  for (const u of users) {
    try {
      if (!u.address || !u.address.street) continue;
      const coords = await geocodeAddress(u.address);
      if (coords) {
        u.address.coordinates = coords;
        await u.save();
        updated++;
        console.log(`Updated ${u.email}: ${coords.latitude},${coords.longitude}`);
        await delay(150); // respect rate limits
      }
    } catch (e) {
      console.warn(`Failed ${u.email}: ${e.message}`);
    }
  }

  console.log(`Backfill done. Updated: ${updated}`);
  await mongoose.disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
