import Restaurant from '../models/Restaurant.js';
import Offer from '../models/Offer.js';
import Coupon from '../models/Coupon.js';
import FeeSettings from '../models/FeeSettings.js';
import ServiceSettings from '../models/ServiceSettings.js';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import { calculateRoute } from './routeCalculationService.js';
import { calculateDeliveryFee as calculateDeliveryFeeByDistance } from './deliveryFeeService.js';

/**
 * Get active fee settings from database
 * Returns default values if no settings found
 */
/**
 * Get active fee settings from database
 * Returns default values if no settings found
 */
export const getFeeSettings = async () => {
  try {
    const feeSettings = await FeeSettings.findOne({ isActive: true }).
      sort({ createdAt: -1 }).
      lean();

    if (feeSettings) {
      return feeSettings;
    }

    // Return default values if no active settings found
    return {
      deliveryFee: 25,
      freeDeliveryThreshold: 149,
      platformFee: 5,
      gstRate: 5,
      fixedFee: 0
    };
  } catch (error) {
    console.error('Error fetching fee settings:', error);
    // Return default values on error
    return {
      deliveryFee: 25,
      freeDeliveryThreshold: 149,
      platformFee: 5,
      gstRate: 5,
      fixedFee: 0
    };
  }
};

/**
 * Normalize coordinate input to [longitude, latitude] array
 * Handles:
 * 1. [lng, lat] array
 * 2. { latitude, longitude } object
 * 3. { lat, lng } object
 * 4. { coordinates: [lng, lat] } GeoJSON object
 * 5. { location: { coordinates: [lng, lat] } } Nested GeoJSON
 * 6. { location: { latitude, longitude } } Nested flat object
 */
export const normalizeCoordinates = (input) => {
  if (!input) return null;

  // 1. If it's already an array [lng, lat]
  if (Array.isArray(input) && input.length >= 2) {
    return [Number(input[0]), Number(input[1])];
  }

  // 2. If it's a nested location object (like from address or restaurant model)
  if (input.location) {
    return normalizeCoordinates(input.location);
  }

  // 3. If it's a GeoJSON object { coordinates: [lng, lat] }
  if (input.coordinates && Array.isArray(input.coordinates)) {
    return [Number(input.coordinates[0]), Number(input.coordinates[1])];
  }

  // 4. If it's a flat object with latitude/longitude
  const lat = input.latitude ?? input.lat;
  const lng = input.longitude ?? input.lng;

  if (lat !== undefined && lng !== undefined) {
    return [Number(lng), Number(lat)];
  }

  return null;
};

/**
 * Calculate distance between two points (Haversine formula)
 * @param {Array|Object} point1 - First coordinate point
 * @param {Array|Object} point2 - Second coordinate point
 * @returns {number|null} - Distance in kilometers
 */
export const calculateDistance = (point1, point2) => {
  const coord1 = normalizeCoordinates(point1);
  const coord2 = normalizeCoordinates(point2);

  if (!coord1 || !coord2) return null;

  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  // If any coordinates are [0,0], return 0 to avoid massive incorrect distances
  if (lng1 === 0 && lat1 === 0 || lng2 === 0 && lat2 === 0) {
    return 0;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Calculate delivery distance using road-route distance (OSRM) with Haversine fallback.
 * This keeps user cart distance and settlement distance aligned.
 */
export const calculateDeliveryDistance = async (restaurant, deliveryAddress = null) => {
  const restaurantCoord = normalizeCoordinates(restaurant);
  const customerCoord = normalizeCoordinates(deliveryAddress);

  if (!restaurantCoord || !customerCoord) return null;

  const [restaurantLng, restaurantLat] = restaurantCoord;
  const [customerLng, customerLat] = customerCoord;

  // Guard invalid map points
  if (restaurantLng === 0 && restaurantLat === 0 || customerLng === 0 && customerLat === 0) {
    return 0;
  }

  try {
    const route = await calculateRoute(restaurantLat, restaurantLng, customerLat, customerLng);
    if (route && typeof route.distance === 'number' && !Number.isNaN(route.distance)) {
      return route.distance;
    }
  } catch (error) {
    console.warn(`Road distance calculation failed, falling back to Haversine: ${error.message}`);
  }

  return calculateDistance(restaurant, deliveryAddress);
};

/**
 * Calculate delivery fee based on distance and service settings
 */
export const calculateDeliveryFee = async (distanceInKm, cachedServiceSettings = null) => {
  const serviceSettings = cachedServiceSettings || await ServiceSettings.getSettings();
  return calculateDeliveryFeeByDistance(distanceInKm, serviceSettings);
};

/**
 * Calculate platform fee based on distance
 * @param {number} distanceInKm - Distance between user and restaurant in kilometers
 * @returns {Promise<number>} - Platform fee amount
 */
export const calculatePlatformFee = async (distanceInKm = null, cachedFeeSettings = null) => {
  const feeSettings = cachedFeeSettings || await getFeeSettings();

  // If distance is provided and platform fee ranges are configured, use range-based calculation
  if (distanceInKm !== null && distanceInKm !== undefined &&
    feeSettings.platformFeeRanges &&
    Array.isArray(feeSettings.platformFeeRanges) &&
    feeSettings.platformFeeRanges.length > 0) {

    // Sort ranges by min value to ensure proper checking
    const sortedRanges = [...feeSettings.platformFeeRanges].sort((a, b) => a.min - b.min);

    // Find matching range (distance >= min && distance < max)
    // For the last range, we check distance >= min && distance <= max
    for (let i = 0; i < sortedRanges.length; i++) {
      const range = sortedRanges[i];
      const isLastRange = i === sortedRanges.length - 1;

      if (isLastRange) {
        // Last range: include max value
        if (distanceInKm >= range.min && distanceInKm <= range.max) {
          return range.fee;
        }
      } else {
        // Other ranges: exclude max value (handled by next range)
        if (distanceInKm >= range.min && distanceInKm < range.max) {
          return range.fee;
        }
      }
    }
  }

  // Fallback to default platform fee if no range matches or distance not provided
  return feeSettings.platformFee || 5;
};

/**
 * Calculate GST (Goods and Services Tax)
 * GST is calculated on subtotal after discounts
 */
export const calculateGST = async (subtotal, discount = 0, cachedFeeSettings = null) => {
  try {
    const feeSettings = cachedFeeSettings || await getFeeSettings();
    const gstRate = Number(feeSettings?.gstRate) || 0;
    const taxableAmount = Math.max(0, Number(subtotal || 0) - Number(discount || 0));
    const gstAmount = (taxableAmount * gstRate) / 100;
    return Math.round(gstAmount * 100) / 100;
  } catch (error) {
    console.error('Error calculating GST:', error);
    return 0;
  }
};

/**
 * Calculate discount based on coupon code
 */
export const calculateDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;

  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return 0; // Minimum order not met
  }

  if (coupon.type === 'percentage') {
    const maxDiscount = coupon.maxDiscount || Infinity;
    const discount = Math.min(
      Math.round(subtotal * (coupon.discount / 100)),
      maxDiscount
    );
    return discount;
  } else if (coupon.type === 'flat') {
    return Math.min(coupon.discount, subtotal); // Can't discount more than subtotal
  }

  // Default: flat discount
  return Math.min(coupon.discount || 0, subtotal);
};


/**
 * Main function to calculate order pricing
 */
export const calculateOrderPricing = async ({
  items,
  restaurantId,
  deliveryAddress = null,
  couponCode = null,
  tip = 0,
  donation = 0
}) => {
  try {
    // Get fee settings
    const feeSettings = await getFeeSettings();
    const fixedFee = feeSettings.fixedFee || 0;
    const serviceSettings = await ServiceSettings.getSettings();

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price) || 0;
      return sum + (price * quantity);
    }, 0);

    if (subtotal <= 0) {
      throw new Error('Order subtotal must be greater than 0');
    }

    // Get restaurant details
    let restaurant = null;
    if (restaurantId) {
      // Robust ObjectId check
      const isObjectId = mongoose.Types.ObjectId.isValid(restaurantId) && 
                         (typeof restaurantId === 'object' || String(restaurantId).length === 24);

      if (isObjectId) {
        restaurant = await Restaurant.findById(restaurantId).lean();
      }
      
      if (!restaurant) {
        restaurant = await Restaurant.findOne({
          $or: [
            { _id: isObjectId ? restaurantId : null },
            { restaurantId: restaurantId },
            { slug: restaurantId }
          ].filter(item => item && (item._id !== null || item.restaurantId || item.slug))
        }).lean();
      }
    }

    // Calculate coupon discount
    let discount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      try {
        const now = new Date();

        // 1. Check Global Coupon first (New System)
        const globalCoupon = await Coupon.findOne({
          couponCode: couponCode.toUpperCase(),
          status: 'active',
          startDate: { $lte: now },
          endDate: { $gte: now }
        }).lean();

        if (globalCoupon) {
          // Validate Restaurant Scope
          let isRestaurantValid = globalCoupon.restaurantScope === 'all';
          if (!isRestaurantValid && restaurant) {
            const rId = restaurant._id?.toString() || restaurantId;
            isRestaurantValid = globalCoupon.restaurantIds.some(id => id.toString() === rId);
          }

          // Validate Min Order Value
          const isMinOrderMet = subtotal >= globalCoupon.minOrderValue;

          if (isRestaurantValid && isMinOrderMet) {
            // Calculate Discount
            const calculatedDiscount = Math.round((subtotal * globalCoupon.discountPercentage) / 100);
            discount = Math.min(calculatedDiscount, globalCoupon.maxDiscountLimit);

            appliedCoupon = {
              code: globalCoupon.couponCode,
              discount: discount,
              discountPercentage: globalCoupon.discountPercentage,
              minOrder: globalCoupon.minOrderValue,
              maxDiscountLimit: globalCoupon.maxDiscountLimit,
              type: 'global' // Admin Coupon
            };
          }
        }

        // 2. Fallback to Legacy Offer Coupon (if no global coupon matched)
        if (!appliedCoupon && restaurant) {
          // Get restaurant ObjectId
          let restaurantObjectId = restaurant._id;
          if (!restaurantObjectId && mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
            restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
          }

          if (restaurantObjectId) {
            // Find active offer with this coupon code for this restaurant
            const searchCode = couponCode.toUpperCase();
            const offer = await Offer.findOne({
              restaurant: restaurantObjectId,
              status: 'active',
              'items.couponCode': searchCode,
              startDate: { $lte: now },
              $or: [
                { endDate: { $gte: now } },
                { endDate: null }]
            }).lean();

            if (offer) {
              // Find the specific item coupon
              const couponItem = offer.items.find((item) => item.couponCode.toUpperCase() === searchCode);

              if (couponItem) {
                // Check if coupon is valid for items in cart - use robust string comparison
                const cartItemIds = items.map((item) => item.itemId?.toString());
                const isValidForCart = couponItem.itemId && cartItemIds.includes(couponItem.itemId.toString());

                // Check minimum order value
                const minOrderMet = !offer.minOrderValue || subtotal >= offer.minOrderValue;

                if (isValidForCart && minOrderMet) {
                  // Calculate discount based on offer item - use robust string comparison
                  const itemInCart = items.find((item) => item.itemId?.toString() === couponItem.itemId.toString());
                  if (itemInCart) {
                    const itemQuantity = Math.max(1, Number(itemInCart.quantity) || 1);
                    const discountPerItem = (couponItem.originalPrice || 0) - (couponItem.discountedPrice || 0);
                    discount = Math.round(discountPerItem * itemQuantity);
                    const itemPrice = Number(itemInCart.price) || 0;
                    const itemSubtotal = itemPrice * itemQuantity;
                    discount = Math.min(discount, itemSubtotal);
                  }

                  appliedCoupon = {
                    code: couponCode,
                    discount: discount,
                    discountPercentage: couponItem.discountPercentage,
                    minOrder: offer.minOrderValue || 0,
                    type: offer.discountType === 'percentage' ? 'percentage' : 'flat',
                    itemId: couponItem.itemId,
                    itemName: couponItem.itemName,
                    originalPrice: couponItem.originalPrice,
                    discountedPrice: couponItem.discountedPrice
                  };
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching coupon from database: ${error.message}`);
      }
    }

    // Calculate distance once and reuse it for all pricing components
    const distanceInKm = await calculateDeliveryDistance(restaurant, deliveryAddress);

    // Calculate delivery fee
    const deliveryFee = await calculateDeliveryFee(distanceInKm, serviceSettings);

    // Apply free delivery from coupon
    const finalDeliveryFee = appliedCoupon?.freeDelivery ? 0 : deliveryFee;

    // Calculate platform fee based on distance
    const platformFee = await calculatePlatformFee(distanceInKm, feeSettings);

    // Calculate GST on subtotal after discount
    const gst = await calculateGST(subtotal, discount, feeSettings);

    // Calculate total
    const total = subtotal - discount + finalDeliveryFee + platformFee + fixedFee + gst + Number(tip) + Number(donation);

    // Calculate savings (discount + any delivery savings)
    const savings = discount + (deliveryFee > finalDeliveryFee ? deliveryFee - finalDeliveryFee : 0);

    // Calculate split for settlement
    const adminDiscount = appliedCoupon?.type === 'global' ? Math.round(discount) : 0;
    const restaurantDiscount = appliedCoupon?.type !== 'global' ? Math.round(discount) : 0;

    return {
      subtotal: Math.round(subtotal),
      discount: Math.round(discount),
      adminDiscount: adminDiscount,
      restaurantDiscount: restaurantDiscount,
      couponType: appliedCoupon?.type || null,
      deliveryFee: Math.round(finalDeliveryFee),
      platformFee: Math.round(platformFee),
      fixedFee: Math.round(fixedFee),
      tax: gst, // Already rounded in calculateGST
      tip: Number(tip),
      donation: Number(donation),
      total: Math.round(total),
      savings: Math.round(savings),
      distance: distanceInKm ? Math.round(distanceInKm * 100) / 100 : null,
      distanceStr: distanceInKm ? `${distanceInKm.toFixed(1)} km` : null,
      appliedCoupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discount: discount,
        freeDelivery: appliedCoupon.freeDelivery || false,
        type: appliedCoupon.type
      } : null,
      breakdown: {
        itemTotal: Math.round(subtotal),
        discountAmount: Math.round(discount),
        adminDiscount: adminDiscount,
        restaurantDiscount: restaurantDiscount,
        deliveryFee: Math.round(finalDeliveryFee),
        platformFee: Math.round(platformFee),
        fixedFee: Math.round(fixedFee),
        gst: gst,
        tip: Number(tip),
        donation: Number(donation),
        total: Math.round(total),
        distance: distanceInKm ? Math.round(distanceInKm * 100) / 100 : null
      }
    };
  } catch (error) {
    // Pass through specific rule/distance errors for user-friendly messaging
    if (['DELIVERY_RULE_NOT_FOUND', 'DELIVERY_DISTANCE_EXCEEDS_MAX_RULE', 'DELIVERY_RULE_INVALID'].includes(error.message)) {
      throw error;
    }
    throw new Error(`Failed to calculate order pricing: ${error.message}`);
  }
};
