import Order from '../models/Order.js';
import '../models/User.js';
import '../models/Restaurant.js';
import '../models/Delivery.js';
import {
  notifyDeliveryBoyOrderReady,
  notifyDeliveryBoyNewOrder,
  notifyMultipleDeliveryBoys
} from './deliveryNotificationService.js';
import {
  assignOrderToDeliveryBoy,
  findNearestDeliveryBoys
} from './deliveryAssignmentService.js';

/**
 * Automatically mark orders as ready when ETA becomes 0
 * This runs as a cron job to check all preparing orders
 * @returns {Promise<{processed: number, message: string}>}
 */
export async function processAutoReadyOrders() {
  try {
    // Find all orders with status 'preparing' that have tracking.preparing.timestamp
    const preparingOrders = await Order.find({
      status: 'preparing',
      'tracking.preparing.timestamp': { $exists: true },
      estimatedDeliveryTime: { $exists: true, $gt: 0 }
    })
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    const now = new Date();
    let processedCount = 0;
    let reassignedReadyCount = 0;

    const tryAssignOrBroadcastReadyOrder = async (readyOrder, logOrderId) => {
      try {
        const orderDoc = await Order.findById(readyOrder?._id);
        const coords = readyOrder?.restaurantId?.location?.coordinates;

        if (!orderDoc || !Array.isArray(coords) || coords.length < 2) {
          return;
        }

        const [restaurantLng, restaurantLat] = coords;
        const restaurantId =
          orderDoc.restaurantId ||
          readyOrder?.restaurantId?._id?.toString?.() ||
          readyOrder?.restaurantId?.restaurantId;

        const assignmentResult = await assignOrderToDeliveryBoy(
          orderDoc,
          restaurantLat,
          restaurantLng,
          restaurantId
        );

        if (assignmentResult?.deliveryPartnerId) {
          const assignedOrder = await Order.findById(orderDoc._id)
            .populate('userId', 'name phone')
            .lean();
          if (assignedOrder) {
            await notifyDeliveryBoyNewOrder(assignedOrder, assignmentResult.deliveryPartnerId);
          }
          reassignedReadyCount++;
          return;
        }

        const isCod = orderDoc.payment?.method === 'cash' || orderDoc.payment?.method === 'cod';
        const codAmount = Number(orderDoc?.pricing?.total) || 0;

        let candidates = await findNearestDeliveryBoys(
          restaurantLat,
          restaurantLng,
          restaurantId,
          20,
          10,
          isCod,
          codAmount
        );

        if (!candidates || candidates.length === 0) {
          candidates = await findNearestDeliveryBoys(
            restaurantLat,
            restaurantLng,
            restaurantId,
            50,
            20,
            isCod,
            codAmount
          );
        }

        if (candidates && candidates.length > 0) {
          const notifyIds = candidates.map((c) => c.deliveryPartnerId);
          await Order.findByIdAndUpdate(orderDoc._id, {
            $set: {
              'assignmentInfo.priorityDeliveryPartnerIds': notifyIds,
              'assignmentInfo.assignedBy': 'auto_ready',
              'assignmentInfo.assignedAt': new Date()
            }
          });

          const notifyOrder = await Order.findById(orderDoc._id)
            .populate('userId', 'name phone')
            .populate('restaurantId', 'name location address phone ownerPhone')
            .lean();
          if (notifyOrder) {
            await notifyMultipleDeliveryBoys(notifyOrder, notifyIds, 'priority');
            reassignedReadyCount++;
          }
        }
      } catch (assignmentError) {
        console.error(`Auto-ready assignment failed for order ${logOrderId}:`, assignmentError);
      }
    };

    for (const order of preparingOrders) {
      const preparingTimestamp = order.tracking?.preparing?.timestamp;
      if (!preparingTimestamp) continue;

      // Calculate elapsed time in minutes
      const elapsedMs = now - new Date(preparingTimestamp);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      const estimatedTime = order.estimatedDeliveryTime || 0;

      // Check if ETA has elapsed
      if (elapsedMinutes >= estimatedTime) {
        try {
          // Update order status to ready
          const updatedOrder = await Order.findByIdAndUpdate(
            order._id,
            {
              $set: {
                status: 'ready',
                'tracking.ready': {
                  status: true,
                  timestamp: now
                }
              }
            },
            { new: true }
          )
            .populate('restaurantId', 'name location address phone ownerPhone restaurantId')
            .populate('userId', 'name phone')
            .populate('deliveryPartnerId', 'name phone')
            .lean();

          if (!updatedOrder) continue;
          processedCount++;

          // If already assigned, notify that rider order is ready.
          if (updatedOrder.deliveryPartnerId) {
            try {
              await notifyDeliveryBoyOrderReady(
                updatedOrder,
                updatedOrder.deliveryPartnerId._id || updatedOrder.deliveryPartnerId
              );
            } catch (notifError) {
              console.error(`Error notifying delivery boy about order ${order.orderId}:`, notifError);
            }
            continue;
          }

          // Unassigned order became ready via cron. Trigger assignment/broadcast.
          await tryAssignOrBroadcastReadyOrder(updatedOrder, order.orderId);
        } catch (updateError) {
          console.error(`Error updating order ${order.orderId} to ready:`, updateError);
        }
      }
    }

    // Retry assignment for already-ready but still-unassigned orders (stuck cases).
    const stuckReadyOrders = await Order.find({
      status: 'ready',
      $or: [
        { deliveryPartnerId: { $exists: false } },
        { deliveryPartnerId: null }
      ]
    })
      .populate('restaurantId', 'name location address phone ownerPhone restaurantId')
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    for (const readyOrder of stuckReadyOrders) {
      await tryAssignOrBroadcastReadyOrder(readyOrder, readyOrder.orderId);
    }

    return {
      processed: processedCount,
      message: processedCount > 0
        ? `Marked ${processedCount} order(s) as ready automatically; reassigned ${reassignedReadyCount} ready order(s)`
        : `No new auto-ready orders; reassigned ${reassignedReadyCount} ready order(s)`
    };
  } catch (error) {
    console.error('Error processing auto-ready orders:', error);
    return { processed: 0, message: `Error: ${error.message}` };
  }
}
