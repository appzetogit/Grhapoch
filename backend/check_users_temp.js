
import mongoose from 'mongoose';
import User from './models/User.js';

async function checkUsers() {
  try {
    const mongoURI = 'mongodb+srv://grhapoch_db_user:cgoxdBiIThjVS9ca@grhapoch.tbq66wh.mongodb.net/?appName=grhapoch';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB Atlas');
    
    const latestUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(`🔍 Found ${latestUsers.length} users:`);
    latestUsers.forEach(u => {
      console.log(`- ID: ${u._id} | Name: ${u.name} | Phone: ${u.phone} | Email: ${u.email}`);
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkUsers();
