#!/usr/bin/env node

/**
 * Script to mark all user accounts as OTP verified
 * This allows users to login without email verification during development
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/User');

async function markAllOTPVerified() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');

    console.log('🔍 Finding all users...');
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users`);

    if (users.length === 0) {
      console.log('ℹ️ No users found in database');
      return;
    }

    console.log('🔄 Marking all users as OTP verified...');
    
    const updateResult = await User.updateMany(
      {}, // Match all users
      {
        $set: {
          'otp.verified': true,
          'otp.code': null,
          'otp.expireAt': null
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} users`);
    
    // Display updated users for verification
    console.log('\n📋 Updated Users:');
    const updatedUsers = await User.find({}, 'email firstName lastName role otp.verified').lean();
    
    updatedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.firstName} ${user.lastName}) - ${user.role} - OTP Verified: ${user.otp?.verified || false}`);
    });

    console.log('\n🎉 All users are now OTP verified and can login!');

  } catch (error) {
    console.error('❌ Error marking users as OTP verified:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  markAllOTPVerified();
}

module.exports = markAllOTPVerified;
