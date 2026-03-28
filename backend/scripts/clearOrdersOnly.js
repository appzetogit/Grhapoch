import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Order from '../models/Order.js';
import OrderEvent from '../models/OrderEvent.js';
import OrderSettlement from '../models/OrderSettlement.js';
import Payment from '../models/Payment.js';
import ETALog from '../models/ETALog.js';
import UserWallet from '../models/UserWallet.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import AdminWallet from '../models/AdminWallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');

dotenv.config({ path: envPath });

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getLastTransactionAt = (transactions) => {
  if (!transactions.length) return null;
  let latest = null;
  for (const tx of transactions) {
    const createdAt = tx.createdAt ? new Date(tx.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      continue;
    }
    if (!latest || createdAt > latest) {
      latest = createdAt;
    }
  }
  return latest;
};

const recomputeUserWallet = (wallet) => {
  let balance = 0;
  let totalAdded = 0;
  let totalSpent = 0;
  let totalRefunded = 0;

  for (const tx of wallet.transactions) {
    if (tx.status !== 'Completed') continue;
    const amount = toNumber(tx.amount);
    if (tx.type === 'addition') {
      balance += amount;
      totalAdded += amount;
    } else if (tx.type === 'refund') {
      balance += amount;
      totalRefunded += amount;
    } else if (tx.type === 'deduction') {
      balance -= amount;
      totalSpent += amount;
    }
  }

  wallet.balance = Math.max(0, balance);
  wallet.totalAdded = Math.max(0, totalAdded);
  wallet.totalSpent = Math.max(0, totalSpent);
  wallet.totalRefunded = Math.max(0, totalRefunded);
  wallet.lastTransactionAt = getLastTransactionAt(wallet.transactions);
};

const recomputeDeliveryWallet = (wallet) => {
  let totalBalance = 0;
  let cashInHand = 0;
  let totalWithdrawn = 0;
  let totalEarned = 0;

  const transactions = [...wallet.transactions].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

  for (const tx of transactions) {
    if (tx.status !== 'Completed') continue;
    const amount = toNumber(tx.amount);
    const paymentCollected = Boolean(tx.paymentCollected);

    if (['payment', 'bonus', 'refund', 'earning_addon', 'tip'].includes(tx.type)) {
      totalBalance += amount;
      totalEarned += amount;
      if (paymentCollected) {
        cashInHand += amount;
      }
    } else if (tx.type === 'withdrawal') {
      totalBalance -= amount;
      totalWithdrawn += amount;
      if (paymentCollected) {
        cashInHand = Math.max(0, cashInHand - amount);
      }
    } else if (tx.type === 'deduction') {
      totalBalance -= amount;
      cashInHand = Math.max(0, cashInHand - amount);
    } else if (tx.type === 'deposit') {
      cashInHand = Math.max(0, cashInHand - amount);
    }
  }

  wallet.totalBalance = Math.max(0, totalBalance);
  wallet.cashInHand = Math.max(0, cashInHand);
  wallet.totalWithdrawn = Math.max(0, totalWithdrawn);
  wallet.totalEarned = Math.max(0, totalEarned);
  wallet.lastTransactionAt = getLastTransactionAt(wallet.transactions);
};

const recomputeRestaurantWallet = (wallet) => {
  let totalBalance = 0;
  let totalWithdrawn = 0;
  let totalEarned = 0;

  for (const tx of wallet.transactions) {
    if (tx.status !== 'Completed') continue;
    const amount = toNumber(tx.amount);
    if (['payment', 'bonus', 'refund'].includes(tx.type)) {
      totalBalance += amount;
      totalEarned += amount;
    } else if (tx.type === 'withdrawal') {
      totalBalance -= amount;
      totalWithdrawn += amount;
    } else if (tx.type === 'deduction') {
      totalBalance -= amount;
    }
  }

  wallet.totalBalance = Math.max(0, totalBalance);
  wallet.totalWithdrawn = Math.max(0, totalWithdrawn);
  wallet.totalEarned = Math.max(0, totalEarned);
  wallet.lastTransactionAt = getLastTransactionAt(wallet.transactions);
};

const recomputeAdminWallet = (wallet) => {
  let totalBalance = 0;
  let totalCommission = 0;
  let totalPlatformFee = 0;
  let totalDeliveryFee = 0;
  let totalGST = 0;
  let totalDonations = 0;
  let totalWithdrawn = 0;

  for (const tx of wallet.transactions) {
    if (tx.status !== 'Completed') continue;
    const amount = toNumber(tx.amount);
    if (tx.type === 'commission') {
      totalBalance += amount;
      totalCommission += amount;
    } else if (tx.type === 'platform_fee') {
      totalBalance += amount;
      totalPlatformFee += amount;
    } else if (tx.type === 'delivery_fee') {
      totalBalance += amount;
      totalDeliveryFee += amount;
    } else if (tx.type === 'gst') {
      totalBalance += amount;
      totalGST += amount;
    } else if (tx.type === 'donation') {
      totalBalance += amount;
      totalDonations += amount;
    } else if (tx.type === 'withdrawal') {
      totalBalance -= amount;
      totalWithdrawn += amount;
    } else if (tx.type === 'deduction') {
      totalBalance -= amount;
    } else if (tx.type === 'refund') {
      totalBalance = Math.max(0, totalBalance - amount);
    }
  }

  wallet.totalBalance = Math.max(0, totalBalance);
  wallet.totalCommission = Math.max(0, totalCommission);
  wallet.totalPlatformFee = Math.max(0, totalPlatformFee);
  wallet.totalDeliveryFee = Math.max(0, totalDeliveryFee);
  wallet.totalGST = Math.max(0, totalGST);
  wallet.totalDonations = Math.max(0, totalDonations);
  wallet.totalWithdrawn = Math.max(0, totalWithdrawn);
  wallet.lastTransactionAt = getLastTransactionAt(wallet.transactions);
};

const filterOrderTransactions = (transactions, orderIdSet) =>
  transactions.filter((tx) => {
    if (!tx.orderId) return true;
    return !orderIdSet.has(tx.orderId.toString());
  });

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const orders = await Order.find({}, { _id: 1 }).lean();
  const orderIds = orders.map((o) => o._id);
  const orderIdSet = new Set(orderIds.map((id) => id.toString()));

  console.log(`Found orders: ${orderIds.length}`);

  if (orderIds.length === 0) {
    console.log('No orders found. Exiting.');
    await mongoose.disconnect();
    return;
  }

  const deletionResults = await Promise.all([
    OrderEvent.deleteMany({ orderId: { $in: orderIds } }),
    OrderSettlement.deleteMany({ orderId: { $in: orderIds } }),
    Payment.deleteMany({ orderId: { $in: orderIds } }),
    ETALog.deleteMany({ orderId: { $in: orderIds } })
  ]);

  const [orderEventsResult, orderSettlementsResult, paymentsResult, etaLogsResult] = deletionResults;

  const userWallets = await UserWallet.find({ 'transactions.orderId': { $in: orderIds } });
  const deliveryWallets = await DeliveryWallet.find({ 'transactions.orderId': { $in: orderIds } });
  const restaurantWallets = await RestaurantWallet.find({ 'transactions.orderId': { $in: orderIds } });
  const adminWallets = await AdminWallet.find({ 'transactions.orderId': { $in: orderIds } });

  for (const wallet of userWallets) {
    wallet.transactions = filterOrderTransactions(wallet.transactions, orderIdSet);
    recomputeUserWallet(wallet);
    await wallet.save();
  }

  for (const wallet of deliveryWallets) {
    wallet.transactions = filterOrderTransactions(wallet.transactions, orderIdSet);
    recomputeDeliveryWallet(wallet);
    await wallet.save();
  }

  for (const wallet of restaurantWallets) {
    wallet.transactions = filterOrderTransactions(wallet.transactions, orderIdSet);
    recomputeRestaurantWallet(wallet);
    await wallet.save();
  }

  for (const wallet of adminWallets) {
    wallet.transactions = filterOrderTransactions(wallet.transactions, orderIdSet);
    recomputeAdminWallet(wallet);
    await wallet.save();
  }

  const ordersResult = await Order.deleteMany({ _id: { $in: orderIds } });

  console.log('✅ Deleted Order-related collections:');
  console.log(`- OrderEvent: ${orderEventsResult.deletedCount}`);
  console.log(`- OrderSettlement: ${orderSettlementsResult.deletedCount}`);
  console.log(`- Payment: ${paymentsResult.deletedCount}`);
  console.log(`- ETALog: ${etaLogsResult.deletedCount}`);
  console.log(`- Order: ${ordersResult.deletedCount}`);

  console.log('✅ Wallets updated (order transactions removed):');
  console.log(`- UserWallet: ${userWallets.length}`);
  console.log(`- DeliveryWallet: ${deliveryWallets.length}`);
  console.log(`- RestaurantWallet: ${restaurantWallets.length}`);
  console.log(`- AdminWallet: ${adminWallets.length}`);

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error('❌ Cleanup failed:', error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error('❌ Failed to disconnect MongoDB:', disconnectError);
  }
  process.exit(1);
});
