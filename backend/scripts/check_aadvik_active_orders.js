import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../models/Order.js';

dotenv.config({ path: './backend/.env' });

async function checkAadvikActiveOrders() {
  await connectDB();
  
  const aadvikId = '69f85c695695ca8c166dd963';
  
  const orders = await Order.find({ 
    deliveryPartnerId: aadvikId,
    status: { $nin: ['delivered', 'cancelled'] }
  });

  console.log(`Found ${orders.length} active orders for Aadvik.`);
  orders.forEach(o => {
    console.log(`OrderID: ${o.orderId}, Status: ${o.status}, Phase: ${o.deliveryState?.currentPhase}`);
  });

  process.exit(0);
}

checkAadvikActiveOrders();
