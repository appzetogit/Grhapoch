import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

async function cleanup() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
  }

  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  
  // List of collections to COMPLETELY clear (everything removed)
  const collectionsToClear = [
    'restaurants',
    'deliveries',
    'orders',
    'orderevents',
    'ordersettlements',
    'menus',
    'userwallets',
    'restaurantwallets',
    'deliverywallets',
    'payments',
    'subscriptionpayments',
    'advertisements',
    'useradvertisements',
    'feedbacks',
    'feedbackexperiences',
    'restaurantcomplaints',
    'deliverysupporttickets',
    'deliverywithdrawalrequests',
    'withdrawalrequests',
    'otps',
    'auditlogs',
    'herobanners',
    'top10restaurants',
    'gourmetrestaurants',
    'inventories',
    'diningbookings',
    'donations',
    'etalogs',
    'earningaddonhistories',
    'restaurantnotifications',
    'razorpaywebhookevents',
    'carts',
    'notifications',
    'reviews',
    'diningrestaurants',
    'diningtables',
    'orderhistories'
  ];

  console.log('🧹 Starting cleanup process...');

  for (const collName of collectionsToClear) {
    try {
      // Check if collection exists before attempting to delete
      const collections = await db.listCollections({ name: collName }).toArray();
      if (collections.length > 0) {
        const result = await db.collection(collName).deleteMany({});
        console.log(`   - [${collName}]: Deleted ${result.deletedCount} documents`);
      } else {
        console.log(`   - [${collName}]: Collection does not exist, skipping`);
      }
    } catch (e) {
      console.warn(`   ⚠️ [${collName}]: Error during cleanup - ${e.message}`);
    }
  }

  // SPECIAL CASE: Clear Users EXCEPT Admins
  try {
    const usersColl = await db.listCollections({ name: 'users' }).toArray();
    if (usersColl.length > 0) {
      const result = await db.collection('users').deleteMany({ 
        role: { $nin: ['admin', 'super-admin'] } 
      });
      console.log(`   - [users]: Deleted ${result.deletedCount} documents (Admins preserved)`);
    }
  } catch (e) {
    console.warn(`   ⚠️ [users]: Error during cleanup - ${e.message}`);
  }

  console.log('✨ Cleanup finished successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
