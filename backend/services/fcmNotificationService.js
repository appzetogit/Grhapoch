import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Delivery from '../models/Delivery.js';
import Zone from '../models/Zone.js';
import { sendPushNotification } from './fcmAdminService.js';
// Local logger placeholder
const logger = {
    error: (msg) => console.error(`[FCM-Notif] ${msg}`),
    info: (msg) => console.log(`[FCM-Notif] ${msg}`)
};

/**
 * Send push notification to a user
 */
export const notifyUserFCM = async (userId, title, body, data = {}) => {
    try {
        const user = await User.findById(userId).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
        if (!user) return;

        const tokens = [user.fcmTokenWeb, user.fcmTokenAndroid, user.fcmTokenIos].filter(Boolean);
        if (tokens.length === 0) return;

        return await sendPushNotification(tokens, {
            title,
            body,
            data: { ...data, type: 'USER_NOTIFICATION' }
        });
    } catch (error) {
        logger.error(`Error sending User FCM: ${error.message}`);
    }
};

/**
 * Send push notification to a restaurant
 */
export const notifyRestaurantFCM = async (restaurantId, title, body, data = {}) => {
    try {
        const restaurant = await Restaurant.findById(restaurantId).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
        if (!restaurant) return;

        const tokens = [restaurant.fcmTokenWeb, restaurant.fcmTokenAndroid, restaurant.fcmTokenIos].filter(Boolean);
        if (tokens.length === 0) return;

        return await sendPushNotification(tokens, {
            title,
            body,
            data: { ...data, type: 'RESTAURANT_NOTIFICATION' }
        });
    } catch (error) {
        logger.error(`Error sending Restaurant FCM: ${error.message}`);
    }
};

/**
 * Send push notification to a delivery partner
 */
export const notifyDeliveryFCM = async (deliveryId, title, body, data = {}) => {
    try {
        const delivery = await Delivery.findById(deliveryId).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
        if (!delivery) return;

        const tokens = [delivery.fcmTokenWeb, delivery.fcmTokenAndroid, delivery.fcmTokenIos].filter(Boolean);
        if (tokens.length === 0) return;

        return await sendPushNotification(tokens, {
            title,
            body,
            data: { ...data, type: 'DELIVERY_NOTIFICATION' }
        });
    } catch (error) {
        logger.error(`Error sending Delivery FCM: ${error.message}`);
    }
};

/**
 * Send push notification to multiple delivery partners
 */
export const notifyMultipleDeliveryFCM = async (deliveryIds, title, body, data = {}) => {
    try {
        const partners = await Delivery.find({ _id: { $in: deliveryIds } }).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
        const tokens = partners.reduce((acc, p) => {
            if (p.fcmTokenWeb) acc.push(p.fcmTokenWeb);
            if (p.fcmTokenAndroid) acc.push(p.fcmTokenAndroid);
            if (p.fcmTokenIos) acc.push(p.fcmTokenIos);
            return acc;
        }, []);

        if (tokens.length === 0) return;

        return await sendPushNotification(tokens, {
            title,
            body,
            data: { ...data, type: 'DELIVERY_NOTIFICATION_BATCH' }
        });
    } catch (error) {
        logger.error(`Error sending Multiple Delivery FCM: ${error.message}`);
    }
};

/**
 * Broadcast notification to a target group, optionally filtered by zone
 */
export const broadcastNotification = async (target, zoneId, title, body, imageUrl = null) => {
    try {
        let tokens = [];
        const data = { type: 'BROADCAST_NOTIFICATION' };

        if (target === 'Customer') {
            // For now, target all users. Filtering users by zone would require spatial query on their addresses.
            const query = { role: 'user', isActive: true };
            const users = await User.find(query).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
            users.forEach(u => {
                if (u.fcmTokenWeb) tokens.push(u.fcmTokenWeb);
                if (u.fcmTokenAndroid) tokens.push(u.fcmTokenAndroid);
                if (u.fcmTokenIos) tokens.push(u.fcmTokenIos);
            });
        } else if (target === 'Delivery Man') {
            const query = { isActive: true };
            if (zoneId && zoneId !== 'All') {
                query['availability.zones'] = zoneId;
            }
            const deliveryPartners = await Delivery.find(query).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
            deliveryPartners.forEach(p => {
                if (p.fcmTokenWeb) tokens.push(p.fcmTokenWeb);
                if (p.fcmTokenAndroid) tokens.push(p.fcmTokenAndroid);
                if (p.fcmTokenIos) tokens.push(p.fcmTokenIos);
            });
        } else if (target === 'Restaurant') {
            let query = { isActive: true };
            if (zoneId && zoneId !== 'All') {
                // If a zone is selected, find restaurants associated with that zone
                const zones = await Zone.find({ _id: zoneId }).select('restaurantId').lean();
                const restaurantIds = zones.map(z => z.restaurantId).filter(Boolean);
                query = { _id: { $in: restaurantIds }, isActive: true };
            }
            const restaurants = await Restaurant.find(query).select('fcmTokenWeb fcmTokenAndroid fcmTokenIos').lean();
            restaurants.forEach(r => {
                if (r.fcmTokenWeb) tokens.push(r.fcmTokenWeb);
                if (r.fcmTokenAndroid) tokens.push(r.fcmTokenAndroid);
                if (r.fcmTokenIos) tokens.push(r.fcmTokenIos);
            });
        }

        if (tokens.length === 0) {
            logger.info(`No tokens found for broadcast to ${target} in zone ${zoneId}`);
            return { successCount: 0, failureCount: 0 };
        }

        return await sendPushNotification(tokens, {
            title,
            body,
            imageUrl,
            data
        });
    } catch (error) {
        logger.error(`Error in broadcastNotification: ${error.message}`);
        throw error;
    }
};
