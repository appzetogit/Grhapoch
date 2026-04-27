
import mongoose from 'mongoose';
import OneTimeCoupon from '../backend/models/OneTimeCoupon.js';

async function checkCoupons() {
  try {
    // Hardcoded local MongoDB URL
    await mongoose.connect('mongodb://localhost:27017/grhapoch');
    console.log('✅ Connected to MongoDB');
    
    const latestCoupons = await OneTimeCoupon.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (latestCoupons.length === 0) {
      console.log('❌ No OneTimeCoupons found in the database.');
    } else {
      console.log(`🔍 Found ${latestCoupons.length} coupons:`);
      latestCoupons.forEach(c => {
        console.log(`- Code: ${c.code} | User: ${c.userId} | Active: ${c.isActive} | Used: ${c.usedCount}/${c.usageLimit} | Expiry: ${c.expiryDate}`);
        if (c.reservationExpiresAt) {
          console.log(`  └ Reservation: ${c.reservationExpiresAt} (Expired: ${new Date() > new Date(c.reservationExpiresAt)})`);
        }
      });
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkCoupons();
