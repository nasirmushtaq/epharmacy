const mongoose = require('mongoose');
const Address = require('../models/Address');
const User = require('../models/User');
require('dotenv').config();

const seedAddresses = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find a customer user to add addresses to
    const customer = await User.findOne({ role: 'customer' });
    if (!customer) {
      console.log('No customer found. Please create a customer user first.');
      process.exit(1);
    }

    console.log(`Found customer: ${customer.firstName} ${customer.lastName} (${customer.email})`);

    // Clear existing addresses for this user
    await Address.deleteMany({ user: customer._id });
    console.log('Cleared existing addresses');

    // Sample addresses
    const sampleAddresses = [
      {
        user: customer._id,
        title: 'Home',
        name: customer.firstName + ' ' + customer.lastName,
        phone: '+91 9876543210',
        line1: 'Apt 123, Green Park Apartments',
        line2: 'Sector 15',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110016',
        country: 'India',
        addressType: 'home',
        isDefault: true,
        landmark: 'Near Metro Station',
        location: {
          latitude: 28.5494,
          longitude: 77.2301
        }
      },
      {
        user: customer._id,
        title: 'Office',
        name: customer.firstName + ' ' + customer.lastName,
        phone: '+91 9876543210',
        line1: 'Tech Tower, 5th Floor',
        line2: 'Cyber City',
        city: 'Gurgaon',
        state: 'Haryana',
        zipCode: '122002',
        country: 'India',
        addressType: 'office',
        isDefault: false,
        landmark: 'Near DLF Mall',
        location: {
          latitude: 28.4595,
          longitude: 77.0266
        }
      },
      {
        user: customer._id,
        title: "Mom's Place",
        name: customer.firstName + ' ' + customer.lastName,
        phone: '+91 9876543211',
        line1: 'House No. 45, Rose Garden',
        line2: 'Civil Lines',
        city: 'Ludhiana',
        state: 'Punjab',
        zipCode: '141001',
        country: 'India',
        addressType: 'other',
        isDefault: false,
        landmark: 'Near Rose Garden',
        location: {
          latitude: 30.9010,
          longitude: 75.8573
        }
      }
    ];

    // Insert sample addresses
    const createdAddresses = await Address.insertMany(sampleAddresses);
    console.log(`Created ${createdAddresses.length} sample addresses:`);
    
    createdAddresses.forEach((addr, index) => {
      console.log(`${index + 1}. ${addr.title} - ${addr.fullAddress}`);
    });

    console.log('\nSample addresses created successfully!');
  } catch (error) {
    console.error('Error seeding addresses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

seedAddresses();
