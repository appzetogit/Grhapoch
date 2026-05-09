import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../models/Order.js';

dotenv.config({ path: './backend/.env' });

async function checkOrder() {
  await connectDB();
  
  const order = await Order.findOne({ orderId: 'ORD-1778306584255-909' });
  if (order) {
    console.log('Order Status:', order.status);
    console.log('Delivery Partner ID:', order.deliveryPartnerId);
    console.log('Delivery Phase:', order.deliveryState?.currentPhase);
  } else {
    console.log('Order not found in DB');
  }

  process.exit(0);
}

checkOrder();
