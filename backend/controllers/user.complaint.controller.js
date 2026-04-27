import RestaurantComplaint from '../models/RestaurantComplaint.js';
import Order from '../models/Order.js';
import Restaurant from '../models/Restaurant.js';
import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * Submit a complaint for an order
 * POST /api/user/complaints
 */
export const submitComplaint = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId, complaintType, subject, description, attachments, requestedAction } = req.body;

    // Validation
    if (!orderId) {
      return errorResponse(res, 400, 'Order ID is required');
    }
    if (!complaintType) {
      return errorResponse(res, 400, 'Complaint type is required');
    }
    if (!subject || !subject.trim()) {
      return errorResponse(res, 400, 'Subject is required');
    }
    if (!description || !description.trim()) {
      return errorResponse(res, 400, 'Description is required');
    }

    // Validate complaint type
    const validTypes = ['food_quality', 'wrong_item', 'missing_item', 'delivery_issue', 'packaging', 'pricing', 'service', 'other'];
    if (!validTypes.includes(complaintType)) {
      return errorResponse(res, 400, 'Invalid complaint type');
    }

    // For mismatch complaints, requestedAction is required.
    const isMismatchComplaint = ['wrong_item', 'missing_item'].includes(complaintType);
    const normalizedRequestedAction = requestedAction ? String(requestedAction).toUpperCase().trim() : null;
    if (isMismatchComplaint) {
      if (!normalizedRequestedAction || !['REFUND', 'COUPON'].includes(normalizedRequestedAction)) {
        return errorResponse(res, 400, 'requestedAction is required for mismatch complaints (REFUND or COUPON)');
      }
    }

    // Get order details (support both Mongo ObjectId and business orderId)
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && String(orderId).length === 24) {
      order = await Order.findById(orderId).lean();
    }
    if (!order) {
      order = await Order.findOne({ orderId: String(orderId) }).lean();
    }
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order belongs to the user
    const orderUserId = order.userId?.toString ? order.userId.toString() : order.userId;
    if (orderUserId !== userId.toString()) {
      return errorResponse(res, 403, 'You can only submit complaints for your own orders');
    }

    // Check if complaint already exists for this order
    const existingComplaint = await RestaurantComplaint.findOne({ orderId: order._id, customerId: userId });
    if (existingComplaint) {
      return errorResponse(res, 400, 'You have already submitted a complaint for this order');
    }

    // Only allow complaints for delivered orders and within 24 hours of delivery.
    const isDelivered = String(order.status || '').toLowerCase() === 'delivered' || !!order.tracking?.delivered?.status;
    if (!isDelivered) {
      return errorResponse(res, 400, 'You can raise a complaint only for delivered orders');
    }

    const deliveredAt = order.deliveredAt || order.tracking?.delivered?.timestamp || order.updatedAt || order.createdAt || null;
    if (!deliveredAt) {
      return errorResponse(res, 400, 'Delivery time not found for this order');
    }
    const ageMs = Date.now() - new Date(deliveredAt).getTime();
    const limitMs = 24 * 60 * 60 * 1000;
    if (ageMs > limitMs) {
      return errorResponse(res, 400, 'Complaint window expired. You can raise a complaint within 24 hours of delivery.');
    }

    // Get restaurant details
    let restaurant = null;
    if (order.restaurantId && mongoose.Types.ObjectId.isValid(order.restaurantId)) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { _id: order.restaurantId },
          { restaurantId: String(order.restaurantId) }
        ]
      }).lean();
    }
    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Create complaint
    const complaintData = {
      orderId: order._id,
      orderNumber: order.orderId || order.orderNumber || `ORD-${order._id.toString().slice(-8)}`,
      customerId: userId,
      customerName: req.user.name || 'Customer',
      customerPhone: req.user.phone || 'N/A',
      customerEmail: req.user.email || '',
      restaurantId: restaurant._id,
      restaurantName: restaurant.name || 'Restaurant',
      complaintType,
      subject: subject.trim(),
      description: description.trim(),
      status: 'pending',
      priority: 'medium',
      attachments: Array.isArray(attachments) ? attachments : [],
      requestedAction: isMismatchComplaint ? normalizedRequestedAction : (normalizedRequestedAction || null)
    };

    const complaint = await RestaurantComplaint.create(complaintData);

    // Mark order as disputed for mismatch complaints.
    if (isMismatchComplaint) {
      try {
        await Order.updateOne({ _id: order._id }, { $set: { isDisputed: true } });
      } catch (e) {
        // Non-blocking
      }
    }

    return successResponse(res, 201, 'Complaint submitted successfully', {
      complaint: {
        id: complaint._id,
        orderId: complaint.orderId,
        orderNumber: complaint.orderNumber,
        complaintType: complaint.complaintType,
        subject: complaint.subject,
        status: complaint.status,
        createdAt: complaint.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    return errorResponse(res, 500, 'Failed to submit complaint');
  }
});

/**
 * Get user's complaints
 * GET /api/user/complaints
 */
export const getUserComplaints = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { customerId: userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await RestaurantComplaint.find(query)
      .populate('orderId', 'orderId orderNumber status')
      .populate('restaurantId', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await RestaurantComplaint.countDocuments(query);

    return successResponse(res, 200, 'Complaints retrieved successfully', {
      complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching user complaints:', error);
    return errorResponse(res, 500, 'Failed to fetch complaints');
  }
});

/**
 * Get complaint details
 * GET /api/user/complaints/:id
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const complaint = await RestaurantComplaint.findById(id)
      .populate('orderId')
      .populate('restaurantId', 'name profileImage phone')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Check if complaint belongs to the user
    const complaintUserId = complaint.customerId?.toString ? complaint.customerId.toString() : complaint.customerId;
    if (complaintUserId !== userId.toString()) {
      return errorResponse(res, 403, 'You can only view your own complaints');
    }

    return successResponse(res, 200, 'Complaint retrieved successfully', {
      complaint
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    return errorResponse(res, 500, 'Failed to fetch complaint details');
  }
});
