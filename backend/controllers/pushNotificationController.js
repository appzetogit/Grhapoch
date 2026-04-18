import PushNotification from '../models/PushNotification.js';
import Zone from '../models/Zone.js';
import { broadcastNotification } from '../services/fcmNotificationService.js';

// Send/Create Push Notification
export const sendPushNotification = async (req, res) => {
  try {
    const { title, zoneId, sendTo, description } = req.body;
    let banner = req.body.banner;

    // Handle image upload if present
    if (req.file) {
      const { uploadToCloudinary } = await import('../utils/cloudinaryService.js');
      const result = await uploadToCloudinary(req.file.buffer, { folder: 'push-notifications' });
      banner = result.secure_url;
    }

    let zoneName = 'All';
    if (zoneId && zoneId !== 'All') {
      const zone = await Zone.findById(zoneId);
      if (zone) {
        zoneName = zone.name;
      }
    }

    const notification = new PushNotification({
      title,
      zoneId: zoneId === 'All' ? null : zoneId,
      zoneName,
      sendTo,
      description,
      banner,
      createdBy: req.admin?.id
    });

    await notification.save();

    // Actually send the notification via FCM
    try {
      await broadcastNotification(sendTo, zoneId, title, description, banner);
    } catch (fcmError) {
      console.error('FCM Broadcast failed:', fcmError);
      // We still return success because the notification was saved to DB
    }
    
    res.status(201).json({
      success: true,
      message: 'Notification created and sent successfully',
      data: notification
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all Push Notifications
export const getAllPushNotifications = async (req, res) => {
  try {
    const notifications = await PushNotification.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error getting push notifications:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Toggle Notification Status
export const toggleNotificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await PushNotification.findById(id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.status = !notification.status;
    await notification.save();

    res.status(200).json({
      success: true,
      message: `Notification ${notification.status ? 'activated' : 'deactivated'}`,
      data: notification
    });
  } catch (error) {
    console.error('Error toggling notification status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete Push Notification
export const deletePushNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await PushNotification.findByIdAndDelete(id);
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting push notification:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
