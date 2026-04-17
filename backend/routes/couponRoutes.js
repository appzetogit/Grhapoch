import express from 'express';
import { getAvailableCoupons, applyCoupon } from '../controllers/couponController.js';

const router = express.Router();

// Get coupons for a restaurant (Public/User)
router.get('/available/:restaurantId', getAvailableCoupons);

// Apply coupon to cart (Public/User)
router.post('/apply', applyCoupon);

export default router;
