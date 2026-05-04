import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import DeliveryBoyCommission from './models/DeliveryBoyCommission.js';

async function checkRules() {
  await mongoose.connect(process.env.MONGODB_URI);
  const rules = await DeliveryBoyCommission.find({});
  console.log('Delivery Boy Commission Rules:', JSON.stringify(rules, null, 2));
  process.exit(0);
}

checkRules().catch(console.error);
