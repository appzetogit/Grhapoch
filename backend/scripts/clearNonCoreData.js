/**
 * Danger: This script wipes transactional / mutable data so you can test calculations
 * without touching core/admin/subscription records.
 *
 * It removes:
 * - Restaurants, delivery partners, customers
 * - Orders, payments, settlements, events
 * - Wallets / withdrawals / commissions for users, restaurants, delivery
 * - Menus, inventories and related restaurant content
 *
 * It keeps:
 * - Admin accounts and admin settings
 * - Subscription plans & payments
 * - Core settings collections (BusinessSettings, EnvironmentVariable, FeeSettings, etc.)
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/database.js';

// Models to purge
import Order from '../models/Order.js';
import OrderEvent from '../models/OrderEvent.js';
import OrderSettlement from '../models/OrderSettlement.js';
import Payment from '../models/Payment.js';
import RazorpayWebhookEvent from '../models/RazorpayWebhookEvent.js';

import Restaurant from '../models/Restaurant.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import RestaurantCommission from '../models/RestaurantCommission.js';
import RestaurantComplaint from '../models/RestaurantComplaint.js';
import RestaurantNotification from '../models/RestaurantNotification.js';
import Menu from '../models/Menu.js';
import Inventory from '../models/Inventory.js';
import MenuItemSchedule from '../models/MenuItemSchedule.js';

import Delivery from '../models/Delivery.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import DeliveryWithdrawalRequest from '../models/DeliveryWithdrawalRequest.js';
import DeliveryBankDeposit from '../models/DeliveryBankDeposit.js';
import DeliveryBoyCommission from '../models/DeliveryBoyCommission.js';
import DeliverySupportTicket from '../models/DeliverySupportTicket.js';
import DeliveryEmergencyHelp from '../models/DeliveryEmergencyHelp.js';

import User from '../models/User.js';
import UserWallet from '../models/UserWallet.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import UserAdvertisement from '../models/UserAdvertisement.js';

// Optional marketing/offers data that is safe to clear for test runs
import Advertisement from '../models/Advertisement.js';
import Offer from '../models/Offer.js';
import Top10Restaurant from '../models/Top10Restaurant.js';
import SubscriptionPayment from '../models/SubscriptionPayment.js';

// Load .env from the backend project root (cwd when running `node scripts/clearNonCoreData.js`)
dotenv.config({ path: './.env' });

const collectionsToClear = [
  { name: 'Order', model: Order },
  { name: 'OrderEvent', model: OrderEvent },
  { name: 'OrderSettlement', model: OrderSettlement },
  { name: 'Payment', model: Payment },
  { name: 'RazorpayWebhookEvent', model: RazorpayWebhookEvent },

  { name: 'Restaurant', model: Restaurant },
  { name: 'RestaurantWallet', model: RestaurantWallet },
  { name: 'RestaurantCommission', model: RestaurantCommission },
  { name: 'RestaurantComplaint', model: RestaurantComplaint },
  { name: 'RestaurantNotification', model: RestaurantNotification },
  { name: 'Menu', model: Menu },
  { name: 'Inventory', model: Inventory },
  { name: 'MenuItemSchedule', model: MenuItemSchedule },

  { name: 'Delivery', model: Delivery },
  { name: 'DeliveryWallet', model: DeliveryWallet },
  { name: 'DeliveryWithdrawalRequest', model: DeliveryWithdrawalRequest },
  { name: 'DeliveryBankDeposit', model: DeliveryBankDeposit },
  { name: 'DeliveryBoyCommission', model: DeliveryBoyCommission },
  { name: 'DeliverySupportTicket', model: DeliverySupportTicket },
  { name: 'DeliveryEmergencyHelp', model: DeliveryEmergencyHelp },

  { name: 'User', model: User },
  { name: 'UserWallet', model: UserWallet },
  { name: 'WithdrawalRequest', model: WithdrawalRequest },
  { name: 'UserAdvertisement', model: UserAdvertisement },

  { name: 'Advertisement', model: Advertisement },
  { name: 'Offer', model: Offer },
  { name: 'Top10Restaurant', model: Top10Restaurant },
  // Clear subscription revenue but keep subscription plans intact
  { name: 'SubscriptionPayment', model: SubscriptionPayment }
];

const main = async () => {
  await connectDB();

  for (const { name, model } of collectionsToClear) {
    try {
      const result = await model.deleteMany({});
      console.log(`✔ Cleared ${name}: ${result.deletedCount} documents removed`);
    } catch (err) {
      console.error(`✖ Failed to clear ${name}:`, err.message);
    }
  }

  await mongoose.connection.close();
  console.log('Done. Core collections (Admin, SubscriptionPlan, BusinessSettings, etc.) left untouched.');
};

main().catch((err) => {
  console.error('Fatal error clearing data:', err);
  mongoose.connection.close();
  process.exit(1);
});
