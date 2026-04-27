import RestaurantComplaint from '../models/RestaurantComplaint.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Order from '../models/Order.js';
import UserWallet from '../models/UserWallet.js';
import User from '../models/User.js';
import { createRefund } from '../services/razorpayService.js';
import { createOneTimeCoupon } from '../services/oneTimeCouponService.js';
import { notifyUserFCM } from '../services/fcmNotificationService.js';
import OrderSettlement from '../models/OrderSettlement.js';

/**
 * Get all restaurant complaints
 * GET /api/admin/restaurant-complaints
 */
export const getAllComplaints = asyncHandler(async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      complaintType, 
      restaurantId,
      fromDate,
      toDate,
      search
    } = req.query;

    const query = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Complaint type filter
    if (complaintType) {
      query.complaintType = complaintType;
    }

    // Restaurant filter
    if (restaurantId) {
      query.restaurantId = restaurantId;
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { restaurantName: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await RestaurantComplaint.find(query)
      .populate('orderId', 'orderId orderNumber status createdAt')
      .populate('customerId', 'name phone email')
      .populate('restaurantId', 'name restaurantId')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await RestaurantComplaint.countDocuments(query);

    // Get summary statistics
    const stats = await RestaurantComplaint.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusCounts = {};
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });

    return successResponse(res, 200, 'Complaints retrieved successfully', {
      complaints,
      stats: {
        total: total,
        pending: statusCounts.pending || 0,
        in_progress: statusCounts.in_progress || 0,
        resolved: statusCounts.resolved || 0,
        rejected: statusCounts.rejected || 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return errorResponse(res, 500, 'Failed to fetch complaints');
  }
});

/**
 * Get complaint details
 * GET /api/admin/restaurant-complaints/:id
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await RestaurantComplaint.findById(id)
      .populate('orderId')
      .populate('customerId', 'name phone email')
      .populate('restaurantId', 'name restaurantId profileImage')
      .populate('resolvedBy', 'name email')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    return successResponse(res, 200, 'Complaint retrieved successfully', {
      complaint
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return errorResponse(res, 500, 'Failed to fetch complaint details');
  }
});

/**
 * Update complaint status
 * PUT /api/admin/restaurant-complaints/:id/status
 */
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse, internalNotes } = req.body;
    const adminId = req.user._id;

    const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return errorResponse(res, 400, 'Valid status is required');
    }

    const complaint = await RestaurantComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Update status
    complaint.status = status;

    // Update admin response if provided
    if (adminResponse) {
      complaint.adminResponse = adminResponse.trim();
      complaint.adminRespondedAt = new Date();
    }

    // Update internal notes if provided
    if (internalNotes !== undefined) {
      complaint.internalNotes = internalNotes.trim();
    }

    // If resolved, set resolved date and admin
    if (status === 'resolved') {
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = adminId;
    }

    await complaint.save();

    return successResponse(res, 200, 'Complaint status updated successfully', {
      complaint: {
        id: complaint._id,
        status: complaint.status,
        adminResponse: complaint.adminResponse,
        adminRespondedAt: complaint.adminRespondedAt,
        resolvedAt: complaint.resolvedAt
      }
    });
  } catch (error) {
    console.error('Error updating complaint status:', error);
    return errorResponse(res, 500, 'Failed to update complaint status');
  }
});

/**
 * Add internal notes
 * PUT /api/admin/restaurant-complaints/:id/notes
 */
export const updateInternalNotes = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { internalNotes } = req.body;

    const complaint = await RestaurantComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    complaint.internalNotes = internalNotes ? internalNotes.trim() : '';
    await complaint.save();

    return successResponse(res, 200, 'Internal notes updated successfully', {
      complaint: {
        id: complaint._id,
        internalNotes: complaint.internalNotes
      }
    });
  } catch (error) {
    console.error('Error updating internal notes:', error);
    return errorResponse(res, 500, 'Failed to update internal notes');
  }
});

/**
 * Admin action for mismatch complaints: refund / coupon / reject
 * POST /api/admin/restaurant-complaints/:id/mismatch-action
 */
export const mismatchAdminAction = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;
    const { action, refundAmount, adminResponse } = req.body;

    const normalizedAction = action ? String(action).toUpperCase().trim() : null;
    if (!normalizedAction || !['REFUND', 'COUPON', 'REJECT'].includes(normalizedAction)) {
      return errorResponse(res, 400, 'action is required (REFUND, COUPON, REJECT)');
    }

    const complaint = await RestaurantComplaint.findById(id);
    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    const isMismatchComplaint = ['wrong_item', 'missing_item'].includes(complaint.complaintType);
    if (!isMismatchComplaint) {
      return errorResponse(res, 400, 'This action is only available for mismatch complaints');
    }

    if (complaint.adminDecision && ['REFUND', 'COUPON', 'REJECT'].includes(complaint.adminDecision)) {
      return errorResponse(res, 400, 'This complaint is already processed');
    }

    const order = await Order.findById(complaint.orderId).lean();
    if (!order) {
      return errorResponse(res, 404, 'Order not found for this complaint');
    }

    const maxRefund = Number(order.pricing?.total || 0);
    let amount = refundAmount !== undefined && refundAmount !== null
      ? Math.round(Number(refundAmount) || 0)
      : Math.round(maxRefund);

    if (normalizedAction !== 'REJECT') {
      if (!Number.isFinite(amount) || amount <= 0) {
        return errorResponse(res, 400, 'refundAmount must be a positive number');
      }
      if (amount > maxRefund) {
        amount = Math.round(maxRefund);
      }
    } else {
      amount = 0;
    }

    // Always mark admin response timestamps if provided.
    if (adminResponse !== undefined) {
      complaint.adminResponse = String(adminResponse || '').trim();
      complaint.adminRespondedAt = new Date();
    }

    if (normalizedAction === 'REJECT') {
      complaint.adminDecision = 'REJECT';
      complaint.status = 'rejected';
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = adminId;

      await complaint.save();

      // Notify user
      notifyUserFCM(complaint.customerId, 'Complaint Rejected', 'Your mismatch complaint was rejected by admin.', {
        complaintId: complaint._id.toString(),
        orderId: order.orderId || ''
      }).catch(() => {});

      return successResponse(res, 200, 'Complaint rejected', { complaint });
    }

    // Mark order disputed
    try {
      await Order.updateOne({ _id: order._id }, { $set: { isDisputed: true } });
    } catch (e) {}

    if (normalizedAction === 'COUPON') {
      const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const coupon = await createOneTimeCoupon({
        userId: complaint.customerId,
        value: amount,
        expiryDate,
        complaintId: complaint._id
      });

      complaint.adminDecision = 'COUPON';
      complaint.status = 'resolved';
      complaint.refundAmount = amount;
      complaint.couponId = coupon._id;
      complaint.couponCode = coupon.code;
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = adminId;
      
      // Ensure adminResponse is set
      if (!complaint.adminResponse) {
        complaint.adminResponse = `A one-time coupon of ₹${amount} has been issued as a resolution for your complaint. Code: ${coupon.code}`;
        complaint.adminRespondedAt = new Date();
      }

      await complaint.save();

      // Restaurant penalty: ensure restaurant earning is cancelled for this order.
      try {
        const settlement = await OrderSettlement.findOne({ orderId: order._id });
        if (settlement) {
          settlement.restaurantEarning = {
            ...(settlement.restaurantEarning || {}),
            netEarning: 0,
            status: 'cancelled'
          };
          await settlement.save();
        }
      } catch (e) {}

      notifyUserFCM(complaint.customerId, 'Coupon Issued', `A one-time coupon of ₹${amount} has been issued for your complaint.`, {
        complaintId: complaint._id.toString(),
        couponCode: coupon.code
      }).catch(() => {});

      return successResponse(res, 200, 'Coupon issued successfully', {
        complaint,
        coupon: { code: coupon.code, value: coupon.value, expiryDate: coupon.expiryDate }
      });
    }

    // REFUND flow
    const method = String(order.payment?.method || '').toLowerCase();
    const razorpayPaymentId = order.payment?.razorpayPaymentId || order.paymentId || null;

    if (method === 'cash') {
      return errorResponse(res, 400, 'Refund is not supported for COD orders. Please issue a coupon instead.');
    }

    let refundId = null;

    if (method === 'wallet') {
      const wallet = await UserWallet.findOrCreateByUserId(order.userId);
      wallet.addTransaction({
        amount,
        type: 'refund',
        status: 'Completed',
        description: `Mismatch complaint refund - Order #${order.orderId}`,
        orderId: order._id,
        paymentMethod: 'wallet',
        metadata: { complaintId: complaint._id.toString() }
      });
      await wallet.save();

      await User.findByIdAndUpdate(order.userId, {
        'wallet.balance': wallet.balance,
        'wallet.currency': wallet.currency,
        walletBalance: wallet.balance
      });

      refundId = `WALLET_REFUND_${Date.now()}`;
    } else if (method === 'razorpay' || method === 'razorpay_tip' || method === 'upi' || method === 'card') {
      if (!razorpayPaymentId) {
        return errorResponse(res, 400, 'Missing Razorpay paymentId for refund');
      }
      const refund = await createRefund(razorpayPaymentId, Math.round(amount * 100), {
        reason: 'ORDER_MISMATCH_COMPLAINT',
        complaintId: complaint._id.toString(),
        orderId: order.orderId || ''
      });
      refundId = refund?.id || null;
    } else {
      // Fallback: treat as online if paymentId exists
      if (!razorpayPaymentId) {
        return errorResponse(res, 400, 'Refund is not supported for this payment method');
      }
      const refund = await createRefund(razorpayPaymentId, Math.round(amount * 100), {
        reason: 'ORDER_MISMATCH_COMPLAINT',
        complaintId: complaint._id.toString(),
        orderId: order.orderId || ''
      });
      refundId = refund?.id || null;
    }

    // Update complaint
    complaint.adminDecision = 'REFUND';
    complaint.status = 'resolved';
    complaint.refundAmount = amount;
    complaint.refundId = refundId;
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = adminId;

    if (!complaint.adminResponse) {
      complaint.adminResponse = `A refund of ₹${amount} has been processed for your complaint. Refund ID: ${refundId || 'Pending'}`;
      complaint.adminRespondedAt = new Date();
    }

    await complaint.save();

    // Update order refund markers (best-effort)
    try {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            'payment.status': 'refunded',
            refundStatus: 'PROCESSED',
            refundId: refundId || null
          }
        }
      );
    } catch (e) {}

    // Restaurant penalty: cancel earning.
    try {
      const settlement = await OrderSettlement.findOne({ orderId: order._id });
      if (settlement) {
        settlement.restaurantEarning = {
          ...(settlement.restaurantEarning || {}),
          netEarning: 0,
          status: 'cancelled'
        };
        await settlement.save();
      }
    } catch (e) {}

    notifyUserFCM(complaint.customerId, 'Refund Processed', `Refund of ₹${amount} has been processed for your complaint.`, {
      complaintId: complaint._id.toString(),
      refundId: refundId || ''
    }).catch(() => {});

    return successResponse(res, 200, 'Refund processed successfully', { complaint, refundId });
  } catch (error) {
    console.error('Error processing mismatch admin action:', error);
    return errorResponse(res, 500, error.message || 'Failed to process admin action');
  }
});
