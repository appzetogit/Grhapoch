import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Advertisement from '../models/Advertisement.js';

dotenv.config();

async function createTestAd() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const testAd = await Advertisement.create({
      restaurant: new mongoose.Types.ObjectId('65f1a2b3c4d5e6f7a8b9c0d1'), // Mock ID
      adType: 'restaurant_banner',
      category: 'Banner Promotion',
      title: 'Test Ad',
      description: 'Test Description',
      bannerImage: 'http://example.com/banner.jpg',
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
      paymentStatus: 'unpaid'
    });

    console.log('Test Ad Created:', testAd.adId);
    
    // Cleanup
    await Advertisement.findByIdAndDelete(testAd._id);
    console.log('Test Ad Cleaned up');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestAd();
