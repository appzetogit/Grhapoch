
import mongoose from 'mongoose';
import OneTimeCoupon from './models/OneTimeCoupon.js';

async function testQuery() {
  try {
    const mongoURI = 'mongodb+srv://grhapoch_db_user:cgoxdBiIThjVS9ca@grhapoch.tbq66wh.mongodb.net/?appName=grhapoch';
    await mongoose.connect(mongoURI);
    
    const userIdStr = '69e7329382da85921dce1408';
    const code = 'MIS-AE9S9SFN';
    const now = new Date();
    
    console.log(`Querying for code: ${code}, userId: ${userIdStr}`);
    
    const oneTime = await OneTimeCoupon.findOne({
      code: code,
      userId: userIdStr,
      isActive: true,
      expiryDate: { $gte: now },
      $expr: { $lt: ['$usedCount', '$usageLimit'] }
    }).lean();
    
    if (oneTime) {
      console.log('✅ Coupon found!');
      console.log(JSON.stringify(oneTime, null, 2));
    } else {
      console.log('❌ Coupon NOT found.');
      
      // Try with ObjectId
      console.log('Retrying with mongoose.Types.ObjectId...');
      const oneTimeObj = await OneTimeCoupon.findOne({
        code: code,
        userId: new mongoose.Types.ObjectId(userIdStr),
        isActive: true,
        expiryDate: { $gte: now },
        $expr: { $lt: ['$usedCount', '$usageLimit'] }
      }).lean();
      
      if (oneTimeObj) {
        console.log('✅ Coupon found with ObjectId!');
      } else {
        console.log('❌ Coupon still NOT found.');
        
        // Try just by code
        const justCode = await OneTimeCoupon.findOne({ code }).lean();
        if (justCode) {
          console.log(`🔍 Coupon exists but query failed. Owner: ${justCode.userId}`);
          console.log(`Expiry: ${justCode.expiryDate} (Now: ${now})`);
          console.log(`UsedCount: ${justCode.usedCount}, UsageLimit: ${justCode.usageLimit}`);
          console.log(`Active: ${justCode.isActive}`);
        }
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testQuery();
