import RestaurantComplaint from '../models/RestaurantComplaint.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * Get complaints for restaurant
 * GET /api/restaurant/complaints
 */
export const getRestaurantComplaints = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { page = 1, limit = 20, status, complaintType, fromDate, toDate, search } = req.query;

    const query = { restaurantId };

    // Status filter
    if (status) {
      query.status = status;
    }

    // Complaint type filter
    if (complaintType) {
      query.complaintType = complaintType;
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

    // Search filter (order number, customer details, subject/description)
    if (search) {
      const q = String(search).trim();
      if (q) {
        query.$or = [
          { orderNumber: { $regex: q, $options: 'i' } },
          { customerName: { $regex: q, $options: 'i' } },
          { customerPhone: { $regex: q, $options: 'i' } },
          { subject: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const complaints = await RestaurantComplaint.find(query)
      .populate('orderId', 'orderId orderNumber status createdAt')
      .populate('customerId', 'name phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await RestaurantComplaint.countDocuments(query);

    // Get summary statistics
    const stats = await RestaurantComplaint.aggregate([
      { $match: { restaurantId } },
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
    console.error('Error fetching restaurant complaints:', error);
    return errorResponse(res, 500, 'Failed to fetch complaints');
  }
});

/**
 * Get complaint details
 * GET /api/restaurant/complaints/:id
 */
export const getComplaintDetails = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;

    const complaint = await RestaurantComplaint.findById(id)
      .populate('orderId')
      .populate('customerId', 'name phone email')
      .lean();

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Check if complaint belongs to the restaurant
    const complaintRestaurantId = complaint.restaurantId?.toString ? complaint.restaurantId.toString() : complaint.restaurantId;
    if (complaintRestaurantId !== restaurantId.toString()) {
      return errorResponse(res, 403, 'You can only view complaints for your restaurant');
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
 * Respond to a complaint
 * PUT /api/restaurant/complaints/:id/respond
 */
export const respondToComplaint = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    const { response } = req.body;

    if (!response || !response.trim()) {
      return errorResponse(res, 400, 'Response is required');
    }

    const complaint = await RestaurantComplaint.findById(id);

    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    // Check if complaint belongs to the restaurant
    const complaintRestaurantId = complaint.restaurantId?.toString ? complaint.restaurantId.toString() : complaint.restaurantId;
    if (complaintRestaurantId !== restaurantId.toString()) {
      return errorResponse(res, 403, 'You can only respond to complaints for your restaurant');
    }

    // Update complaint
    complaint.restaurantResponse = response.trim();
    complaint.restaurantRespondedAt = new Date();
    
    // Update status if it's pending
    if (complaint.status === 'pending') {
      complaint.status = 'in_progress';
    }

    await complaint.save();

    return successResponse(res, 200, 'Response submitted successfully', {
      complaint: {
        id: complaint._id,
        restaurantResponse: complaint.restaurantResponse,
        restaurantRespondedAt: complaint.restaurantRespondedAt,
        status: complaint.status
      }
    });
  } catch (error) {
    console.error('Error responding to complaint:', error);
    return errorResponse(res, 500, 'Failed to submit response');
  }
});

/**
 * Restaurant mismatch review (accept/reject)
 * POST /api/restaurant/complaints/:id/mismatch-review
 */
export const reviewMismatchComplaint = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const restaurantId = req.restaurant._id;
    const { decision, response } = req.body;

    const normalizedDecision = decision ? String(decision).toUpperCase().trim() : null;
    if (!normalizedDecision || !['ACCEPT', 'REJECT'].includes(normalizedDecision)) {
      return errorResponse(res, 400, 'decision is required (ACCEPT or REJECT)');
    }
    if (!response || !String(response).trim()) {
      return errorResponse(res, 400, 'response is required');
    }

    const complaint = await RestaurantComplaint.findById(id);
    if (!complaint) {
      return errorResponse(res, 404, 'Complaint not found');
    }

    const complaintRestaurantId = complaint.restaurantId?.toString ? complaint.restaurantId.toString() : complaint.restaurantId;
    if (complaintRestaurantId !== restaurantId.toString()) {
      return errorResponse(res, 403, 'You can only review complaints for your restaurant');
    }

    const isMismatchComplaint = ['wrong_item', 'missing_item'].includes(complaint.complaintType);
    if (!isMismatchComplaint) {
      return errorResponse(res, 400, 'This review action is only available for mismatch complaints');
    }

    complaint.restaurantDecision = normalizedDecision;
    complaint.restaurantResponse = String(response).trim();
    complaint.restaurantRespondedAt = new Date();

    if (normalizedDecision === 'REJECT') {
      complaint.status = 'rejected';
    } else if (complaint.status === 'pending') {
      complaint.status = 'in_progress';
    }

    await complaint.save();

    return successResponse(res, 200, 'Mismatch complaint reviewed successfully', {
      complaint: {
        id: complaint._id,
        restaurantDecision: complaint.restaurantDecision,
        restaurantResponse: complaint.restaurantResponse,
        status: complaint.status,
        restaurantRespondedAt: complaint.restaurantRespondedAt
      }
    });
  } catch (error) {
    console.error('Error reviewing mismatch complaint:', error);
    return errorResponse(res, 500, 'Failed to review complaint');
  }
});
