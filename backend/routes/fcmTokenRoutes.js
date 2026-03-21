/**
 * FCM Token Management Routes
 * Handles saving and removing FCM push notification tokens for:
 *  - Users     (authenticated via user JWT)
 *  - Delivery  (authenticated via delivery JWT)
 *  - Restaurants (authenticated via restaurant JWT)
 *
 * All routes resolve to /api/notification/fcm/...
 */
import express from 'express';
import { authenticate as authenticateUser } from '../middleware/auth.js';
import { authenticate as authenticateDelivery } from '../middleware/delivery.auth.js';
import { authenticate as authenticateRestaurant } from '../middleware/restaurant.auth.js';
import User from '../models/User.js';
import Delivery from '../models/Delivery.js';
import Restaurant from '../models/Restaurant.js';

const router = express.Router();

/** Helper: determine which field to use based on platform */
function getTokenField(platform) {
    return platform === 'mobile' ? 'fcmTokenMobile' : 'fcmTokenWeb';
}

/** Helper: get token/platform from body/query with defaults */
function extractTokenPayload(req) {
    const body = req.body || {};
    const token =
        body.token ||
        body.fcmToken ||
        body.fcm_token ||
        req.query?.token ||
        '';
    const platformRaw = body.platform || req.query?.platform || 'mobile';
    const p = String(platformRaw).toLowerCase().trim();
    const normalizedPlatform = (p === 'web' || p === 'browser' || p === 'pwa') ? 'web' : 'mobile';
    return { token, platform: normalizedPlatform };
}

/** Helper: minimal debug log (avoids printing full token) */
function logSave(role, platform, token, userId) {
    const short = token ? `${token.slice(0, 8)}…${token.slice(-6)}` : '';
    console.log(
        `[FCM] save ${role} platform=${platform} token=${short} user=${userId || ''}`
    );
}

/* ─────────────────────────── USER ─────────────────────────── */

// POST /api/notification/fcm/user/save
// Alias for legacy mobile apps: /api/notification/user/token
router.post(['/user/save', '/user/token'], authenticateUser, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const field = getTokenField(platform);
        user[field] = token;
        await user.save();

        logSave('user', platform, token, req.user._id);
        return res.json({ success: true, message: `FCM ${platform} token saved`, token });
    } catch (error) {
        console.error('[FCM] Error saving user token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to save token' });
    }
});

// DELETE /api/notification/fcm/user/remove
// Alias: /api/notification/user/token (DELETE)
router.delete(['/user/remove', '/user/token'], authenticateUser, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const field = getTokenField(platform);
        // Clear token only if it matches the stored one
        if (user[field] === token) {
            user[field] = '';
        }
        await user.save();

        return res.json({ success: true, message: `FCM ${platform || 'web'} token removed` });
    } catch (error) {
        console.error('[FCM] Error removing user token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to remove token' });
    }
});

/* ─────────────────────────── DELIVERY ─────────────────────────── */

// POST /api/notification/fcm/delivery/save
// Alias: /api/notification/delivery/token
router.post(['/delivery/save', '/delivery/token'], authenticateDelivery, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const delivery = await Delivery.findById(req.delivery._id);
        if (!delivery) return res.status(404).json({ success: false, message: 'Delivery partner not found' });

        const field = getTokenField(platform);
        delivery[field] = token;
        await delivery.save();

        logSave('delivery', platform, token, req.delivery._id);
        return res.json({ success: true, message: `FCM ${platform} token saved` });
    } catch (error) {
        console.error('[FCM] Error saving delivery token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to save token' });
    }
});

// DELETE /api/notification/fcm/delivery/remove
// Alias: /api/notification/delivery/token (DELETE)
router.delete(['/delivery/remove', '/delivery/token'], authenticateDelivery, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const delivery = await Delivery.findById(req.delivery._id);
        if (!delivery) return res.status(404).json({ success: false, message: 'Delivery partner not found' });

        const field = getTokenField(platform);
        if (delivery[field] === token) {
            delivery[field] = '';
        }
        await delivery.save();

        return res.json({ success: true, message: `FCM ${platform || 'web'} token removed` });
    } catch (error) {
        console.error('[FCM] Error removing delivery token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to remove token' });
    }
});

/* ─────────────────────────── RESTAURANT ─────────────────────────── */

// POST /api/notification/fcm/restaurant/save
// Alias: /api/notification/restaurant/token
router.post(['/restaurant/save', '/restaurant/token'], authenticateRestaurant, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const restaurant = await Restaurant.findById(req.restaurant._id);
        if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

        const field = getTokenField(platform);
        restaurant[field] = token;
        await restaurant.save();

        logSave('restaurant', platform, token, req.restaurant._id);
        return res.json({ success: true, message: `FCM ${platform} token saved` });
    } catch (error) {
        console.error('[FCM] Error saving restaurant token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to save token' });
    }
});

// DELETE /api/notification/fcm/restaurant/remove
// Alias: /api/notification/restaurant/token (DELETE)
router.delete(['/restaurant/remove', '/restaurant/token'], authenticateRestaurant, async (req, res) => {
    try {
        const { token, platform } = extractTokenPayload(req);
        if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

        const restaurant = await Restaurant.findById(req.restaurant._id);
        if (!restaurant) return res.status(404).json({ success: false, message: 'Restaurant not found' });

        const field = getTokenField(platform);
        if (restaurant[field] === token) {
            restaurant[field] = '';
        }
        await restaurant.save();

        return res.json({ success: true, message: `FCM ${platform || 'web'} token removed` });
    } catch (error) {
        console.error('[FCM] Error removing restaurant token:', error.message);
        return res.status(500).json({ success: false, message: 'Failed to remove token' });
    }
});

export default router;
