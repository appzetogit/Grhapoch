/**
 * One-time cleanup: remove legacy FCM array fields from all documents.
 * Fields removed:
 *   - fcmTokensWeb
 *   - fcmTokensMobile
 *
 * Keep the new single-value fields:
 *   - fcmTokenWeb
 *   - fcmTokenMobile
 *
 * Usage:
 *   NODE_ENV=production node scripts/removeLegacyFcmArrays.js
 *
 * The script uses MONGODB_URI from .env.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Delivery from '../models/Delivery.js';
import Restaurant from '../models/Restaurant.js';

dotenv.config();

async function prune(collection, label) {
  const res = await collection.updateMany(
    {
      $or: [
        { fcmTokensWeb: { $exists: true } },
        { fcmTokensMobile: { $exists: true } },
      ],
    },
    {
      $unset: { fcmTokensWeb: '', fcmTokensMobile: '' },
    }
  );
  console.log(`[cleanup] ${label}: matched=${res.matchedCount} modified=${res.modifiedCount}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || undefined,
  });
  console.log('[cleanup] Connected to MongoDB');

  await prune(User, 'users');
  await prune(Delivery, 'deliveries');
  await prune(Restaurant, 'restaurants');

  await mongoose.disconnect();
  console.log('[cleanup] Done');
}

main().catch((err) => {
  console.error('[cleanup] Error:', err.message);
  process.exit(1);
});
