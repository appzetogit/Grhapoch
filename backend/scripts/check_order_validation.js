import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Order from '../models/Order.js';

dotenv.config({ path: './backend/.env' });

async function checkOrderValidation() {
  await connectDB();
  
  // Get the order ID from the user's screenshot or previous context
  const orderId = 'ORD-1778303771403-108'; // This was the one assigned to Aadvik
  
  const order = await Order.findOne({ orderId });
  if (!order) {
    console.log('Order not found');
    process.exit(1);
  }

  console.log('Current Order Status:', order.status);
  console.log('Current Assignment Info:', JSON.stringify(order.assignmentInfo, null, 2));

  // Try to simulate reached pickup update
  order.deliveryState.status = 'reached_pickup';
  order.deliveryState.currentPhase = 'at_pickup';
  order.deliveryState.reachedPickupAt = new Date();

  try {
    await order.validate();
    console.log('✅ Validation passed');
  } catch (error) {
    console.log('❌ Validation failed:', error.message);
  }

  process.exit(0);
}

checkOrderValidation();
