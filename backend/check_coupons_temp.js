
import mongoose from 'mongoose';
import OneTimeCoupon from './models/OneTimeCoupon.js';

async function checkCoupons() {
  try {
    const mongoURI = 'mongodb+srv://grhapoch_db_user:cgoxdBiIThjVS9ca@grhapoch.tbq66wh.mongodb.net/?appName=grhapoch';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const latestCoupons = await OneTimeCoupon.find()
      .sort({ createdAt: -1 })
      .limit(10);
    
    if (latestCoupons.length === 0) {
      console.log('❌ No OneTimeCoupons found in the database.');
    } else {
      console.log(`🔍 Found ${latestCoupons.length} coupons:`);
      latestCoupons.forEach(c => {
        console.log(`- Code: ${c.code} | User: ${c.userId} | Active: ${c.isActive} | Used: ${c.usedCount}/${c.usageLimit}`);
        console.log(`  Reserved: ${c.reservedByCheckoutId ? 'YES (' + c.reservedByCheckoutId + ')' : 'NO'}`);
        if (c.reservationExpiresAt) {
          const isExpired = new Date() > new Date(c.reservationExpiresAt);
          console.log(`  Reservation Expiry: ${c.reservationExpiresAt} (Expired: ${isExpired})`);
        }
      });
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkCoupons();
