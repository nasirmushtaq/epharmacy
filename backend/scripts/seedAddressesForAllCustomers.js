const mongoose = require('mongoose');
const Address = require('../models/Address');
const User = require('../models/User');
require('dotenv').config();

const seedAddressesForAllCustomers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all customer users
    const customers = await User.find({ role: 'customer' });
    
    if (customers.length === 0) {
      console.log('No customers found.');
      process.exit(1);
    }

    console.log(`Found ${customers.length} customers:`);
    customers.forEach((customer, index) => {
      console.log(`${index + 1}. ${customer.firstName} ${customer.lastName} (${customer.email})`);
    });

    // Process each customer
    for (const customer of customers) {
      // Check if customer already has addresses
      const existingAddresses = await Address.find({ user: customer._id });
      
      if (existingAddresses.length > 0) {
        console.log(`\n${customer.firstName} ${customer.lastName} already has ${existingAddresses.length} address(es). Skipping...`);
        continue;
      }

      console.log(`\nCreating addresses for ${customer.firstName} ${customer.lastName}...`);

      // Sample addresses for this customer
      const sampleAddresses = [
        {
          user: customer._id,
          title: 'Home',
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone || '+91 9876543210',
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
            latitude: 28.5494 + (Math.random() - 0.5) * 0.1, // Add some variation
            longitude: 77.2301 + (Math.random() - 0.5) * 0.1
          }
        },
        {
          user: customer._id,
          title: 'Office',
          name: `${customer.firstName} ${customer.lastName}`,
          phone: customer.phone || '+91 9876543210',
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
            latitude: 28.4595 + (Math.random() - 0.5) * 0.1,
            longitude: 77.0266 + (Math.random() - 0.5) * 0.1
          }
        }
      ];

      // Insert addresses for this customer
      const createdAddresses = await Address.insertMany(sampleAddresses);
      console.log(`✅ Created ${createdAddresses.length} addresses for ${customer.firstName}`);
    }

    console.log('\n🎉 All customers now have sample addresses!');
  } catch (error) {
    console.error('Error seeding addresses:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

seedAddressesForAllCustomers();
