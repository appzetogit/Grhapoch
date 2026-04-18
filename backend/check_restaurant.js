import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Restaurant from './models/Restaurant.js';

dotenv.config();

async function checkRestaurant() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const names = [/mohit/i, /New Restaurant/i, /sapna/i];
    const results = await Restaurant.find({ name: { $in: names } });
    results.forEach(r => {
      console.log('Restaurant:', r.name, '| isActive:', r.isActive, '| businessModel:', r.businessModel);
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkRestaurant();
