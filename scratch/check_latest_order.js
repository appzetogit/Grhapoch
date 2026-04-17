import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../backend/models/Order.js';
import OrderSettlement from '../backend/models/OrderSettlement.js';

dotenv.config({ path: '../backend/.env' });

const checkData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const order = await Order.findOne().sort({ createdAt: -1 }).lean();
    if (!order) {
      console.log('No order found.');
      process.exit(0);
    }

    const settlement = await OrderSettlement.findOne({ orderId: order._id }).lean();
    
    console.log('--- LATEST ORDER PRICING ---');
    console.log(JSON.stringify(order.pricing, null, 2));
    
    console.log('\n--- SETTLEMENT BREAKDOWN ---');
    if (settlement) {
      console.log('Admin Earning:', JSON.stringify(settlement.adminEarning, null, 2));
      console.log('Restaurant Earning:', JSON.stringify(settlement.restaurantEarning, null, 2));
      console.log('User Payment:', JSON.stringify(settlement.userPayment, null, 2));
    } else {
      console.log('Settlement not generated yet. Calculate now...');
      // Note: Ideally we call calculateOrderSettlement here, but let's just see why it's missing
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkData();
