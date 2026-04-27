import Order from '../models/Order.js';
import { notifyRestaurantOrderUpdate } from './restaurantNotificationService.js';
import { notifyUserOrderUpdate } from './userNotificationService.js';
import {
  resolveOrderPaymentContext,
  processRefundByPolicy,
  applyCancellationAndRefundState
} from './orderCancellationRefundService.js';

/**
 * Automatically reject orders that haven't been accepted within the accept time limit
 * This runs as a cron job to check all pending/confirmed orders
 * Accept time limit: 240 seconds (4 minutes)
 * @returns {Promise<{processed: number, message: string}>}
 */
export async function processAutoRejectOrders() {
  try {
    const ACCEPT_TIME_LIMIT_SECONDS = 600; // 10 minutes
    const ACCEPT_TIME_LIMIT_MS = ACCEPT_TIME_LIMIT_SECONDS * 1000;

    // Find all orders with status 'pending' or 'confirmed' that haven't been accepted yet
    // These are orders waiting for restaurant to accept
    const validPendingOrders = await Order.find({
      status: { $in: ['pending', 'confirmed'] }
    }).lean();

    if (validPendingOrders.length === 0) {
      return { processed: 0, message: 'No pending orders to check' };
    }

    const now = new Date();
    let processedCount = 0;
    const rejectedOrders = [];

    for (const order of validPendingOrders) {
      const orderCreatedAt = new Date(order.createdAt);
      const elapsedMs = now - orderCreatedAt;

      // Check if accept time has expired
      if (elapsedMs >= ACCEPT_TIME_LIMIT_MS) {
        try {
          // Double-check order hasn't been accepted or cancelled by another process
          const currentOrder = await Order.findById(order._id);
          if (!currentOrder) {
            continue; // Order was deleted
          }

          // Only reject if still in pending/confirmed status
          if (!['pending', 'confirmed'].includes(currentOrder.status)) {
            continue; // Order was already accepted/rejected
          }

          const cancellationReason = 'Order not accepted within time limit. Restaurant did not respond in time.';

          try {
            const paymentContext = await resolveOrderPaymentContext(currentOrder);
            const refundResult = await processRefundByPolicy({
              order: currentOrder,
              paymentContext,
              reason: cancellationReason,
              cancelledBy: 'restaurant'
            });

            await applyCancellationAndRefundState({
              order: currentOrder,
              reason: cancellationReason,
              cancelledBy: 'restaurant',
              paymentContext,
              refundResult
            });
          } catch (refundError) {
            // Keep auto-reject robust: cancel order even if refund fails, and mark refund failure for visibility.
            currentOrder.status = 'cancelled';
            currentOrder.cancellationReason = cancellationReason;
            currentOrder.cancelledBy = 'restaurant';
            currentOrder.cancelledAt = now;
            currentOrder.refundStatus = 'FAILED';
            await currentOrder.save();
            console.error(`? Auto-refund failed for order ${currentOrder.orderId}:`, refundError.message);
          }

          rejectedOrders.push({
            orderId: currentOrder.orderId,
            elapsedSeconds: Math.floor(elapsedMs / 1000)
          });
          processedCount++;

          // Notify about status update
          try {
            await notifyRestaurantOrderUpdate(currentOrder._id.toString(), 'cancelled');
            notifyUserOrderUpdate(currentOrder._id, 'cancelled').catch((userNotifError) => {
              console.error(`? Error sending user cancellation notification for order ${currentOrder.orderId}:`, userNotifError);
            });
          } catch (notifError) {
            console.error(`? Error sending notification for order ${currentOrder.orderId}:`, notifError);
          }
        } catch (updateError) {
          console.error(`? Error auto-rejecting order ${order.orderId}:`, updateError);
        }
      }
    }

    return {
      processed: processedCount,
      message: processedCount > 0 ?
        `Auto-rejected ${processedCount} order(s) that were not accepted within ${ACCEPT_TIME_LIMIT_SECONDS} seconds` :
        'No orders to auto-reject'
    };
  } catch (error) {
    console.error('? Error processing auto-reject orders:', error);
    return { processed: 0, message: `Error: ${error.message}` };
  }
}
