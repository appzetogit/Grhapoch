import express from 'express';
import fcmTokenRoutes from './fcmTokenRoutes.js';
import notificationPublicRoutes from './notificationPublicRoutes.js';

const router = express.Router();

// Public notifications for users
router.use('/public', notificationPublicRoutes);

// FCM push notification token management
router.use('/fcm', fcmTokenRoutes);
// Aliases for clients calling without the /fcm prefix (e.g., /api/notification/user/token)
router.use('/', fcmTokenRoutes);

router.get('/', (req, res) => {
  res.json({ message: 'Notification module: use /fcm/* endpoints for push notification token management' });
});

export default router;
