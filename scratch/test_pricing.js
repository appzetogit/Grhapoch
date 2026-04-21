
import { calculateOrderPricing } from './backend/services/orderCalculationService.js';
import mongoose from 'mongoose';

async function test() {
  const items = [
    { itemId: '1', name: 'Pizza', price: 100, quantity: 2 }
  ];
  const pricing = await calculateOrderPricing({ items, restaurantId: '60f1a2b3c4d5e6f7a8b9c0d1' });
  console.log('Pricing for 2 items:', pricing.subtotal, 'Total:', pricing.total);
}

test().catch(console.error);
