/**
 * One-time migration:
 *  - Move legacy `fcmTokenMobile` into `fcmTokenAndroid` when Android/iOS token is empty.
 *  - Remove legacy `fcmTokenMobile` field.
 *
 * Run:
 *   node scripts/migrateFcmTokenMobileToPlatform.js
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Delivery from '../models/Delivery.js';

dotenv.config();

async function migrateCollection(Model, name) {
  const docs = await Model.find({ fcmTokenMobile: { $exists: true, $ne: '' } })
    .select('_id fcmTokenMobile fcmTokenAndroid fcmTokenIos')
    .lean();

  let updated = 0;
  for (const doc of docs) {
    const update = { $unset: { fcmTokenMobile: '' } };
    if (!doc.fcmTokenAndroid && !doc.fcmTokenIos) {
      update.$set = { fcmTokenAndroid: doc.fcmTokenMobile };
    }

    await Model.updateOne({ _id: doc._id }, update);
    updated += 1;
  }

  // Also remove any empty legacy fields left behind.
  const cleanup = await Model.updateMany(
    { fcmTokenMobile: { $exists: true } },
    { $unset: { fcmTokenMobile: '' } }
  );

  console.log(`[FCM MIGRATION] ${name}: migrated=${updated}, cleaned=${cleanup.modifiedCount}`);
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[FCM MIGRATION] Connected to MongoDB');

  await migrateCollection(User, 'User');
  await migrateCollection(Restaurant, 'Restaurant');
  await migrateCollection(Delivery, 'Delivery');

  await mongoose.disconnect();
  console.log('[FCM MIGRATION] Done');
}

run().catch(async (error) => {
  console.error('[FCM MIGRATION] Failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
