
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const restaurantSchema = new mongoose.Schema({}, { strict: false });
const Restaurant = mongoose.model('Restaurant', restaurantSchema, 'restaurants');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const r = await Restaurant.findOne({ 'owner.phone': /7509825276/ });
    if (r) {
      console.log(JSON.stringify({
        id: r._id,
        name: r.name,
        onboardingCompleted: r.onboardingCompleted,
        onboarding: r.onboarding,
        isActive: r.isActive
      }, null, 2));
    } else {
      console.log("Restaurant not found with phone 7509825276");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
