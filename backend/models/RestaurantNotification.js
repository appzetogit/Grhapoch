import mongoose from 'mongoose';

const restaurantNotificationSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['subscription_expired', 'subscription_activated', 'general', 'alert', 'payment'],
        default: 'general'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const RestaurantNotification = mongoose.model('RestaurantNotification', restaurantNotificationSchema);

export default RestaurantNotification;
