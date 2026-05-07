import express from 'express';
import { getPublicNotifications } from '../controllers/pushNotificationController.js';

const router = express.Router();

// Public notifications for users/customers
router.get('/active', getPublicNotifications);

export default router;
