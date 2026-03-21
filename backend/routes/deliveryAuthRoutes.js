import express from 'express';
import {
  sendOTP,
  verifyOTP,
  refreshToken,
  logout,
  getCurrentDelivery,
  cancelSignup
} from '../controllers/deliveryAuthController.js';
import { authenticate } from '../middleware/delivery.auth.js';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';
import Delivery from '../models/Delivery.js';
import { extractTokenPayload, getTokenFieldForPlatform } from '../services/fcmTokenPlatformService.js';

const router = express.Router();

// Validation schemas
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .required(),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone')
    .default('login')
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .required(),
  otp: Joi.string().required().length(6),
  purpose: Joi.string()
    .valid('login', 'register', 'reset-password', 'verify-phone')
    .default('login'),
  name: Joi.string().allow(null, '').optional()
});

// Public routes
router.post('/send-otp', validate(sendOTPSchema), sendOTP);
router.post('/verify-otp', validate(verifyOTPSchema), verifyOTP);
router.post('/refresh-token', refreshToken);

// Protected routes (require authentication)
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getCurrentDelivery);
router.post('/cancel-signup', authenticate, cancelSignup);
router.post('/fcm-token', authenticate, async (req, res) => {
  const { token, platform } = extractTokenPayload(req);
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  const delivery = await Delivery.findById(req.delivery._id);
  if (!delivery) {
    return res.status(404).json({ success: false, message: 'Delivery partner not found' });
  }

  const field = getTokenFieldForPlatform(platform);
  delivery[field] = token;
  await delivery.save();

  return res.json({
    success: true,
    message: `FCM ${platform} token saved`,
    data: { platform, tokenField: field }
  });
});

export default router;

