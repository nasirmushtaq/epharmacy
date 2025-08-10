const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [key, ...rest] = a.replace(/^--/, '').split('=');
      if (rest.length) {
        args[key] = rest.join('=');
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          args[key] = next; i++;
        } else {
          args[key] = true;
        }
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/epharmacy';

  const email = (args.email || process.env.ADMIN_EMAIL || 'admin@epharmacy.local').toLowerCase();
  const password = args.password || process.env.ADMIN_PASSWORD || 'Admin@12345';
  const firstName = args.first || process.env.ADMIN_FIRST || 'Admin';
  const lastName = args.last || process.env.ADMIN_LAST || 'User';
  const phone = args.phone || process.env.ADMIN_PHONE || '+911234567890';

  const address = {
    street: args.street || process.env.ADMIN_STREET || '1 Admin Way',
    city: args.city || process.env.ADMIN_CITY || 'Mumbai',
    state: args.state || process.env.ADMIN_STATE || 'MH',
    zipCode: args.zip || process.env.ADMIN_ZIP || '400001',
    country: args.country || process.env.ADMIN_COUNTRY || 'India',
    coordinates: {
      latitude: Number(args.lat || process.env.ADMIN_LAT || 19.0760),
      longitude: Number(args.lng || process.env.ADMIN_LNG || 72.8777)
    }
  };

  console.log('Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    let user = await User.findOne({ email }).select('+password');
    if (user) {
      console.log('Existing user found, updating to admin...');
      user.firstName = firstName;
      user.lastName = lastName;
      user.phone = phone;
      user.address = address;
      user.role = 'admin';
      user.isApproved = true;
      user.isActive = true;
      user.isEmailVerified = true;
      if (args.resetPassword) {
        user.password = password; // will be hashed by pre-save
      }
      await user.save();
      console.log('✅ User updated to admin:', email);
    } else {
      console.log('No existing user found, creating admin...');
      user = await User.create({
        firstName,
        lastName,
        email,
        password,
        phone,
        role: 'admin',
        address,
        isApproved: true,
        isActive: true,
        isEmailVerified: true
      });
      console.log('✅ Admin created:', email);
    }
  } catch (err) {
    console.error('❌ Failed to create/update admin:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main(); 