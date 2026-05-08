import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Advertisement from '../models/Advertisement.js';

dotenv.config();

async function checkAds() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const ads = await Advertisement.find({ adType: 'restaurant_banner' })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('Recent Banner Advertisements:');
    if (ads.length === 0) {
      console.log('No banner advertisements found.');
    }
    ads.forEach(ad => {
      console.log(`- ID: ${ad.adId}, Status: ${ad.status}, CreatedAt: ${ad.createdAt}, Banner: ${ad.bannerImage ? 'Yes' : 'No'}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAds();
