import User from '../models/User.js';
import Restaurant from '../models/Restaurant.js';
import Delivery from '../models/Delivery.js';
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
