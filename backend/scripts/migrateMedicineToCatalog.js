// Run once after deployment: node backend/scripts/migrateMedicineToCatalog.js
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Medicine = require('../models/Medicine');
const Product = require('../models/Product');
const Inventory = require('../models/Inventory');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/epharmacy';
  console.log('Connecting to', uri);
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const meds = await Medicine.find({});
    console.log('Found medicines:', meds.length);
    let createdProducts = 0, createdInventories = 0;

    for (const m of meds) {
      // Upsert Product by name+generic+brand+dosage+strength+packSize
      const key = {
        name: m.name, genericName: m.genericName, brand: m.brand,
        dosageForm: m.dosageForm, strength: m.strength, packSize: m.packSize, unit: m.unit
      };

      let p = await Product.findOne({
        name: key.name, genericName: key.genericName, brand: key.brand,
        dosageForm: key.dosageForm, strength: key.strength, packSize: key.packSize, unit: key.unit
      });

      if (!p) {
        p = await Product.create({
          name: m.name,
          genericName: m.genericName,
          brand: m.brand,
          manufacturer: m.manufacturer,
          description: m.description,
          category: m.category,
          composition: Array.isArray(m.composition) && m.composition.length ? m.composition : (m.strength ? [{ ingredient: m.genericName, strength: m.strength, unit: 'mg' }] : []),
          dosageForm: m.dosageForm,
          strength: m.strength,
          packSize: m.packSize,
          unit: m.unit,
          isPrescriptionRequired: m.isPrescriptionRequired,
          scheduleType: m.scheduleType || 'OTC',
          images: m.images || [],
          isActive: m.isActive !== false,
          tags: m.tags || [],
          legacyMedicineId: m._id
        });
        createdProducts++;
      }

      // Create or update Inventory for the pharmacist who added this medicine
      try {
        const inv = await Inventory.findOneAndUpdate(
          { pharmacy: m.addedBy, product: p._id, batchNumber: m.batchNumber || null },
          {
            $set: {
              sellingPrice: m.sellingPrice,
              mrp: m.mrp,
              stockQuantity: m.stockQuantity,
              minStockLevel: m.minStockLevel || 0,
              manufacturingDate: m.manufacturingDate,
              expiryDate: m.expiryDate,
              isActive: m.isActive !== false
            }
          },
          { upsert: true, new: true }
        );
        createdInventories++;
      } catch (e) {
        console.warn('Inventory upsert failed for', m._id.toString(), e.message);
      }
    }

    console.log('Migration complete:', { createdProducts, createdInventories });
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();


