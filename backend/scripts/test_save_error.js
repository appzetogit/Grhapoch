import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../models/Order.js';

dotenv.config({ path: './backend/.env' });

async function testSave() {
  await connectDB();
  
  // Try one of the 'en_route_to_pickup' orders
  const order = await Order.findOne({ 
    deliveryPartnerId: '69f85c695695ca8c166dd963',
    'deliveryState.currentPhase': 'en_route_to_pickup'
  });

  if (!order) {
    console.log('No en_route_to_pickup order found');
    process.exit(1);
  }

  console.log(`Testing save for order ${order.orderId}`);
  
  order.deliveryState.status = 'reached_pickup';
  order.deliveryState.currentPhase = 'at_pickup';
  order.deliveryState.reachedPickupAt = new Date();

  try {
    await order.save();
    console.log('✅ Save successful');
  } catch (error) {
    console.log('❌ Save failed:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.log(`  Field ${key}: ${error.errors[key].message}`);
      });
    }
  }

  process.exit(0);
}

testSave();
