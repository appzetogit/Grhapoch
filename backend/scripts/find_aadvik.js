import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import Delivery from '../models/Delivery.js';

dotenv.config({ path: './backend/.env' });

async function findAadvik() {
  await connectDB();
  const partners = await Delivery.find({ name: /Aadvik/i });
  console.log(JSON.stringify(partners, null, 2));
  process.exit(0);
}

findAadvik();
