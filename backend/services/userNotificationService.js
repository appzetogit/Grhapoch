import { notifyUserFCM } from './fcmNotificationService.js';
import Order from '../models/Order.js';
import { resolveNotificationTemplate } from './notificationTemplateService.js';

let getIO = null;

async function getIOInstance() {
  if (!getIO) {
    const serverModule = await import('../server.js');
    getIO = serverModule.getIO;
  }
  return getIO ? getIO() : null;
}

const STATUS_TEMPLATE_KEYS = {
  confirmed: 'user.order_confirmed',
  preparing: 'user.order_preparing',
  ready: 'user.order_ready',
  picked_up: 'user.order_picked_up',
  at_delivery: 'user.order_at_delivery',
  delivered: 'user.order_delivered',
  cancelled: 'user.order_cancelled'
};

export async function notifyUserOrderUpdate(orderId, status) {
  try {
    const order = await Order.findById(orderId).select('_id orderId userId restaurantName').lean();
    if (!order) return;

    const io = await getIOInstance();
    const payload = {
      orderId: order.orderId,
      status,
      updatedAt: new Date()
    };

    // Socket.IO notifications
    if (io) {
      io.to(`order:${order._id.toString()}`).emit('order_status_update', payload);
      io.to(`order:${order.orderId}`).emit('order_status_update', payload);
    }

    // FCM notifications
    const templateKey = STATUS_TEMPLATE_KEYS[status] || 'user.order_update';
    const resolved = await resolveNotificationTemplate({
      key: templateKey,
      audience: 'user',
      data: {
        orderId: order.orderId,
        status
      }
    });

    if (resolved?.enabled) {
      await notifyUserFCM(order.userId, resolved.title, resolved.body, {
        orderId: order.orderId,
        orderMongoId: order._id.toString(),
        status
      });
    }
  } catch (error) {
    console.error('Error notifying user about order update:', error);
  }
}
