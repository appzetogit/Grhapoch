import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import Restaurant from '../models/Restaurant.js';
import Offer from '../models/Offer.js';
import OneTimeCoupon from '../models/OneTimeCoupon.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import mongoose from 'mongoose';

// --- Admin APIs ---

/**
 * Create new coupon
 * POST /api/admin/coupons
 */
export const createCoupon = asyncHandler(async (req, res) => {
  const {
    couponCode,
    discountPercentage,
    minOrderValue,
    maxDiscountLimit,
    startDate,
    endDate,
    restaurantScope,
    restaurantIds,
    userScope,
    visibility
  } = req.body;

  // Check if coupon code already exists
  const existingCoupon = await Coupon.findOne({ couponCode: couponCode.toUpperCase() });
  if (existingCoupon) {
    return errorResponse(res, 400, 'Coupon code already exists');
  }

  // Validate dates
  if (new Date(endDate) <= new Date(startDate)) {
    return errorResponse(res, 400, 'End date must be after start date');
  }

  const coupon = await Coupon.create({
    couponCode: couponCode.toUpperCase(),
    discountPercentage,
    minOrderValue,
    maxDiscountLimit,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    restaurantScope,
    restaurantIds: restaurantScope === 'specific' ? restaurantIds : [],
    userScope,
    visibility: visibility || { showOnCheckout: true }
  });

  return successResponse(res, 201, 'Coupon created successfully', coupon);
});

/**
 * Get all coupons for admin
 * GET /api/admin/coupons
 */
export const getAllCouponsAdmin = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find()
    .populate('restaurantIds', 'name restaurantId')
    .sort({ createdAt: -1 });

  // Optional: Auto-update expired status in the result
  const now = new Date();
  const updatedCoupons = coupons.map(coupon => {
    const couponObj = coupon.toObject();
    if (new Date(coupon.endDate) < now && coupon.status === 'active') {
      couponObj.status = 'expired';
    }
    return couponObj;
  });

  return successResponse(res, 200, 'Coupons retrieved successfully', updatedCoupons);
});

/**
 * Update coupon
 * PUT /api/admin/coupons/:id
 */
export const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (updateData.couponCode) {
    updateData.couponCode = updateData.couponCode.toUpperCase();
    const existing = await Coupon.findOne({ couponCode: updateData.couponCode, _id: { $ne: id } });
    if (existing) {
      return errorResponse(res, 400, 'Coupon code already exists');
    }
  }

  const coupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true });
  if (!coupon) {
    return errorResponse(res, 404, 'Coupon not found');
  }

  return successResponse(res, 200, 'Coupon updated successfully', coupon);
});

/**
 * Delete coupon
 * DELETE /api/admin/coupons/:id
 */
export const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) {
    return errorResponse(res, 404, 'Coupon not found');
  }
  return successResponse(res, 200, 'Coupon deleted successfully');
});

// --- User APIs ---

/**
 * Get available coupons for a restaurant
 * GET /api/coupons/available/:restaurantId
 */
export const getAvailableCoupons = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const userId = req.user?._id;
  const now = new Date();

  // Find the restaurant first to get its database _id (in case restaurantId is a custom string)
  let dbRestaurantId = restaurantId;
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    const restaurant = await Restaurant.findOne({
      $or: [{ restaurantId: restaurantId }, { slug: restaurantId }]
    });
    if (restaurant) {
      dbRestaurantId = restaurant._id;
    } else {
      // If restaurant not found by custom ID, and it's not a valid ObjectId, return empty
      return successResponse(res, 200, 'Available coupons retrieved', []);
    }
  }

  // Find valid global/restaurant coupons: Active status, within date range
  const query = {
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { restaurantScope: 'all' },
      { restaurantIds: dbRestaurantId }
    ]
  };

  const coupons = await Coupon.find(query).select('-restaurantIds');

  // Also fetch legacy Offers for this restaurant
  const legacyOffers = await Offer.find({
    restaurant: dbRestaurantId,
    status: 'active',
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } }
    ]
  }).lean();

  // Combine results
  const combinedCoupons = [...coupons.map(c => c.toObject())];

  // Fetch OneTimeCoupons for this specific user (e.g. from mismatch complaints)
  if (userId) {
    const oneTimeCoupons = await OneTimeCoupon.find({
      userId: userId,
      isActive: true,
      expiryDate: { $gte: now },
      $expr: { $lt: ['$usedCount', '$usageLimit'] }
    }).lean();

    oneTimeCoupons.forEach(otc => {
      combinedCoupons.push({
        couponCode: otc.code,
        discountPercentage: 0, // It's usually a flat amount
        flatDiscount: otc.value,
        minOrderValue: 0,
        maxDiscountLimit: otc.value,
        description: otc.source === 'mismatch' ? 'Mismatch complaint resolution' : 'Special one-time offer',
        isOneTime: true,
        expiryDate: otc.expiryDate
      });
    });
  }

  const seenCodes = new Set(combinedCoupons.map(c => c.couponCode || c.code));

  legacyOffers.forEach(offer => {
    // If it's an item-level offer, it has an 'items' array
    if (offer.items && offer.items.length > 0) {
      offer.items.forEach(item => {
        if (item.couponCode && !seenCodes.has(item.couponCode)) {
          seenCodes.add(item.couponCode);
          combinedCoupons.push({
            couponCode: item.couponCode,
            discountPercentage: item.discountPercentage,
            minOrderValue: offer.minOrderValue || 0,
            maxDiscountLimit: offer.maxLimit || 0,
            targetItemName: item.itemName,
            isLegacy: true,
            itemId: item.itemId,
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice
          });
        }
      });
    }
  });

  return successResponse(res, 200, 'Available coupons retrieved', combinedCoupons);
});

/**
 * Apply coupon to cart
 * POST /api/coupons/apply
 */
export const applyCoupon = asyncHandler(async (req, res) => {
  const { couponCode, restaurantId, cartTotal, userId } = req.body;
  const now = new Date();

  const coupon = await Coupon.findOne({
    couponCode: couponCode.toUpperCase(),
    status: 'active',
    startDate: { $lte: now },
    endDate: { $gte: now }
  });

  if (!coupon) {
    return errorResponse(res, 404, 'Invalid or expired coupon');
  }

  // 1. Min Order Value check
  if (cartTotal < coupon.minOrderValue) {
    return errorResponse(res, 400, `Minimum order value for this coupon is ₹${coupon.minOrderValue}`);
  }

  // 2. Restaurant Scope check
  if (coupon.restaurantScope === 'specific') {
    const isRestaurantIncluded = coupon.restaurantIds.some(id => id.toString() === restaurantId);
    if (!isRestaurantIncluded) {
      return errorResponse(res, 400, 'This coupon is not valid for this restaurant');
    }
  }

  // 3. User Scope check
  if (coupon.userScope === 'first-time') {
    const previousOrders = await Order.countDocuments({ user: userId, status: 'delivered' });
    if (previousOrders > 0) {
      return errorResponse(res, 400, 'This coupon is only for first-time orders');
    }
  }

  // 4. Calculate Discount
  let discount = (cartTotal * coupon.discountPercentage) / 100;
  if (coupon.maxDiscountLimit > 0 && discount > coupon.maxDiscountLimit) {
    discount = coupon.maxDiscountLimit;
  }

  const finalPrice = cartTotal - discount;

  return successResponse(res, 200, 'Coupon applied successfully', {
    originalPrice: cartTotal,
    discount: Math.round(discount),
    finalPrice: Math.round(finalPrice),
    couponCode: coupon.couponCode
  });
});
