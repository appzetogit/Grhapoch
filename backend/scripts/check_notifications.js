import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PushNotification from '../models/PushNotification.js';

dotenv.config();

async function checkNotifications() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const count = await PushNotification.countDocuments();
    console.log(`Total notifications in database: ${count}`);

    if (count > 0) {
      const latest = await PushNotification.find().sort({ createdAt: -1 }).limit(5);
      console.log('Latest 5 notifications:');
      latest.forEach((n, i) => {
        console.log(`${i + 1}. Title: ${n.title}, Target: ${n.sendTo}, Date: ${n.createdAt}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNotifications();
