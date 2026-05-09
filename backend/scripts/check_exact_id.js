import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../models/Order.js';

dotenv.config({ path: './backend/.env' });

async function checkExactId() {
  await connectDB();
  
  const order = await Order.findOne({ orderId: 'ORD-1778306584255-909' });
  if (order) {
    console.log('Order Status:', order.status);
    console.log('Delivery Partner ID (Actual):', order.deliveryPartnerId);
    console.log('Delivery Partner ID (String):', order.deliveryPartnerId?.toString());
    console.log('Expected ID:', '69f85c695695ca8c166dd963');
    
    if (order.deliveryPartnerId?.toString() === '69f85c695695ca8c166dd963') {
      console.log('✅ MATCH');
    } else {
      console.log('❌ MISMATCH');
    }
  } else {
    console.log('Order not found');
  }

  process.exit(0);
}

checkExactId();
