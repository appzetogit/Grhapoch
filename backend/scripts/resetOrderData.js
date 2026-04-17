import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Models
import Order from '../models/Order.js';
import OrderEvent from '../models/OrderEvent.js';
import OrderSettlement from '../models/OrderSettlement.js';
import Payment from '../models/Payment.js';
import AdminWallet from '../models/AdminWallet.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import DeliveryWithdrawalRequest from '../models/DeliveryWithdrawalRequest.js';

// Environment variable setup
dotenv.config();

const resetData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env file');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully.');

    console.log('--- Starting Data Reset ---');

    // 1. Delete Order Data
    console.log('Deleting Orders...');
    const orderRes = await Order.deleteMany({});
    console.log(`Deleted ${orderRes.deletedCount} orders.`);
    
    await OrderEvent.deleteMany({});
    await OrderSettlement.deleteMany({});

    // 2. Delete Payments
    console.log('Deleting Payments...');
    await Payment.deleteMany({});

    // 3. Reset Wallets
    console.log('Resetting Admin Wallets...');
    await AdminWallet.deleteMany({});
    
    console.log('Resetting Restaurant Wallets...');
    await RestaurantWallet.updateMany({}, {
      $set: {
        totalEarning: 0,
        pendingEarning: 0,
        withdrawnAmount: 0,
        currentBalance: 0,
        transactions: []
      }
    });

    console.log('Resetting Delivery Wallets...');
    await DeliveryWallet.updateMany({}, {
      $set: {
        totalEarning: 0,
        pendingEarning: 0,
        withdrawnAmount: 0,
        currentBalance: 0,
        cashInHand: 0,
        pendingCashReserve: 0,
        transactions: []
      }
    });

    // 4. Delete Withdrawal Requests
    console.log('Deleting Withdrawal Requests...');
    await WithdrawalRequest.deleteMany({});
    await DeliveryWithdrawalRequest.deleteMany({});

    console.log('\n--- Data Reset Completed Successfully ---');
    console.log('Note: User, Admin, Restaurant, and Delivery accounts were NOT touched.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during reset:', error);
    process.exit(1);
  }
};

resetData();
