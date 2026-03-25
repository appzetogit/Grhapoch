import Restaurant from '../models/Restaurant.js';
import Menu from '../models/Menu.js';
import ServiceSettings from '../models/ServiceSettings.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryService.js';
import { initializeCloudinary } from '../config/cloudinary.js';
import asyncHandler from '../middleware/asyncHandler.js';
import mongoose from 'mongoose';
import { checkSubscriptionExpiry } from './subscriptionController.js';
import BusinessSettings from '../models/BusinessSettings.js';

const parseNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isValidLatitude = (lat) => Number.isFinite(lat) && lat >= -90 && lat <= 90;
const isValidLongitude = (lng) => Number.isFinite(lng) && lng >= -180 && lng <= 180;

const getGeoCoordinates = (payload) => {
  const lat = parseNumber(payload?.lat ?? payload?.latitude);
  const lng = parseNumber(payload?.lng ?? payload?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const resolveLngLatFromLocation = (location) => {
  if (!location) return null;

  const lat = parseNumber(location.latitude ?? location.lat);
  const lng = parseNumber(location.longitude ?? location.lng);
  if (isValidLatitude(lat) && isValidLongitude(lng)) {
    return [lng, lat];
  }

  const coords = location.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const a = parseNumber(coords[0]);
    const b = parseNumber(coords[1]);
    if (isValidLongitude(a) && isValidLatitude(b)) {
      return [a, b];
    }
    if (isValidLongitude(b) && isValidLatitude(a)) {
      return [b, a];
    }
  }

  return null;
};

const backfillGeoLocationForRestaurants = async (limit = 200) => {
  const candidates = await Restaurant.find({
    isActive: true,
    $and: [
      {
        $or: [
          { geoLocation: { $exists: false } },
          { 'geoLocation.coordinates': { $exists: false } },
          { 'geoLocation.coordinates.0': { $exists: false } }
        ]
      },
      {
        $or: [
          { 'location.latitude': { $exists: true } },
          { 'location.longitude': { $exists: true } },
          { 'location.coordinates.0': { $exists: true } }
        ]
      }
    ]
  })
    .select('_id location geoLocation')
    .limit(limit)
    .lean();

  if (!candidates.length) return 0;

  const ops = [];
  for (const candidate of candidates) {
    const coords = resolveLngLatFromLocation(candidate.location);
    if (!coords) continue;

    ops.push({
      updateOne: {
        filter: { _id: candidate._id },
        update: {
          $set: {
            geoLocation: {
              type: 'Point',
              coordinates: coords
            },
            'location.longitude': coords[0],
            'location.latitude': coords[1],
            'location.coordinates': coords
          }
        }
      }
    });
  }

  if (!ops.length) return 0;
  await Restaurant.bulkWrite(ops, { ordered: false });
  return ops.length;
};

const calculateDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get all restaurants (for user module)
export const getRestaurants = async (req, res) => {
  try {
    const {
      limit = 10000, // Increased to show all restaurants
      offset = 0,
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers,
      isVeg,
      lat,
      lng
    } = req.query;

    // Build query
    const query = { isActive: true };

    // Cuisine filter
    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, 'i')] };
    }

    // Rating filter
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Trust filters (top-rated = 4.5+, trusted = 4.0+ with high totalRatings)
    if (req.query.topRated === 'true') {
      query.rating = { $gte: 4.5 };
    } else if (req.query.trusted === 'true') {
      query.rating = { $gte: 4.0 };
      query.totalRatings = { $gte: 100 }; // At least 100 ratings to be "trusted"
    }

    // Delivery time filter (estimatedDeliveryTime contains time in format "25-30 mins")
    // Note: This will be filtered in application logic since it's a string field
    // We don't add it to query.$or to avoid overriding isActive filter

    // Distance filter (distance is stored as string like "1.2 km")
    // Note: This will be filtered in application logic since it's a string field
    // We don't add it to query.$or to avoid overriding isActive filter

    // Price range filter
    if (maxPrice) {
      const priceMap = { 200: ['$'], 500: ['$', '$$'] };
      if (priceMap[maxPrice]) {
        query.priceRange = { $in: priceMap[maxPrice] };
      }
    }

    // Offers filter - combine with existing $or if it exists, otherwise create new
    if (hasOffers === 'true') {
      if (!query.$or) {
        query.$or = [];
      }
      query.$or.push(
        { offer: { $exists: true, $ne: null, $ne: '' } },
        { featuredPrice: { $exists: true } }
      );
    }

    // Veg Mode filter
    if (isVeg === 'true') {
      query.$or = query.$or || [];
      query.$or.push({ isVeg: true }, { isPureVeg: true });
    }

    // Build sort object
    let sortObj = { createdAt: -1 }; // Default: Latest first

    if (sortBy) {
      switch (sortBy) {
        case 'price-low':
          sortObj = { priceRange: 1, rating: -1 }; // $ < $$ < $$$, then by rating
          break;
        case 'price-high':
          sortObj = { priceRange: -1, rating: -1 }; // $$$$ > $$$ > $$ > $, then by rating
          break;
        case 'rating-high':
          sortObj = { rating: -1, totalRatings: -1 }; // Highest rating first
          break;
        case 'rating-low':
          sortObj = { rating: 1, totalRatings: -1 }; // Lowest rating first
          break;
        case 'relevance':
        default:
          sortObj = { rating: -1, totalRatings: -1, createdAt: -1 }; // Relevance: high rating + recent
          break;
      }
    }

    const coords = getGeoCoordinates({ ...req.query, ...req.body, lat, lng });
    if (!coords) {
      return successResponse(res, 200, 'Location coordinates are required to list nearby restaurants', {
        restaurants: [],
        total: 0,
        locationRequired: true
      });
    }

    await backfillGeoLocationForRestaurants();
    const settings = await ServiceSettings.getSettings();
    const serviceRadiusKm = Number(settings?.serviceRadiusKm) || 10;
    query.geoLocation = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat]
        },
        $maxDistance: serviceRadiusKm * 1000
      }
    };

    // Fetch restaurants - zone dependency removed, optional nearby filtering by coordinates
    let restaurantQuery = Restaurant.find(query)
      .select('-owner -createdAt -updatedAt -password')
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // If using geo-near and no explicit sortBy, keep natural distance sort
    if (!coords || sortBy) {
      restaurantQuery = restaurantQuery.sort(sortObj);
    }

    let restaurants = await restaurantQuery.lean();

    // Apply string-based filters that can't be done in MongoDB query
    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      restaurants = restaurants.filter((r) => {
        if (!r.estimatedDeliveryTime) return false;
        const timeMatch = r.estimatedDeliveryTime.match(/(\d+)/);
        return timeMatch && parseInt(timeMatch[1]) <= maxTime;
      });
    }

    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      restaurants = restaurants.filter((r) => {
        if (!r.distance) return false;
        const distMatch = r.distance.match(/(\d+\.?\d*)/);
        return distMatch && parseFloat(distMatch[1]) <= maxDist;
      });
    }

    // Note: total count not used in response to keep payload light






    return successResponse(res, 200, 'Restaurants retrieved successfully', {
      restaurants,
      total: restaurants.length,
      filters: {
        sortBy,
        cuisine,
        minRating,
        maxDeliveryTime,
        maxDistance,
        maxPrice,
        hasOffers
      }
    });
  } catch (error) {
    console.error('Error fetching restaurants:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurants');
  }
};

/**
 * Get nearby restaurants based on coordinates
 * POST /api/restaurant/nearby
 * Body: { lat, lng }
 */
export const getNearbyRestaurants = async (req, res) => {
  try {
    const payload = { ...req.query, ...req.body };
    const {
      limit = 10000,
      offset = 0,
      sortBy,
      cuisine,
      minRating,
      maxDeliveryTime,
      maxDistance,
      maxPrice,
      hasOffers,
      isVeg
    } = payload;

    const coords = getGeoCoordinates(payload);
    if (!coords) {
      return errorResponse(res, 400, 'Valid lat and lng are required');
    }

    await backfillGeoLocationForRestaurants();
    const settings = await ServiceSettings.getSettings();
    const serviceRadiusKm = Number(settings?.serviceRadiusKm) || 10;

    const query = { isActive: true };

    if (cuisine) {
      query.cuisines = { $in: [new RegExp(cuisine, 'i')] };
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (payload.topRated === 'true') {
      query.rating = { $gte: 4.5 };
    } else if (payload.trusted === 'true') {
      query.rating = { $gte: 4.0 };
      query.totalRatings = { $gte: 100 };
    }

    if (maxPrice) {
      const priceMap = { 200: ['$'], 500: ['$', '$$'] };
      if (priceMap[maxPrice]) {
        query.priceRange = { $in: priceMap[maxPrice] };
      }
    }

    if (hasOffers === 'true') {
      if (!query.$or) {
        query.$or = [];
      }
      query.$or.push(
        { offer: { $exists: true, $ne: null, $ne: '' } },
        { featuredPrice: { $exists: true } }
      );
    }

    if (isVeg === 'true') {
      query.$or = query.$or || [];
      query.$or.push({ isVeg: true }, { isPureVeg: true });
    }

    // Nearby filter
    query.geoLocation = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat]
        },
        $maxDistance: serviceRadiusKm * 1000
      }
    };

    // Sort preference (distance is default with $near)
    let sortObj = null;
    if (sortBy) {
      switch (sortBy) {
        case 'price-low':
          sortObj = { priceRange: 1, rating: -1 };
          break;
        case 'price-high':
          sortObj = { priceRange: -1, rating: -1 };
          break;
        case 'rating-high':
          sortObj = { rating: -1, totalRatings: -1 };
          break;
        case 'rating-low':
          sortObj = { rating: 1, totalRatings: -1 };
          break;
        case 'relevance':
        default:
          sortObj = { rating: -1, totalRatings: -1, createdAt: -1 };
          break;
      }
    }

    let restaurantQuery = Restaurant.find(query)
      .select('-owner -createdAt -updatedAt -password')
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    if (sortObj) {
      restaurantQuery = restaurantQuery.sort(sortObj);
    }

    let restaurants = await restaurantQuery.lean();

    if (maxDeliveryTime) {
      const maxTime = parseInt(maxDeliveryTime);
      restaurants = restaurants.filter((r) => {
        if (!r.estimatedDeliveryTime) return false;
        const timeMatch = r.estimatedDeliveryTime.match(/(\d+)/);
        return timeMatch && parseInt(timeMatch[1]) <= maxTime;
      });
    }

    if (maxDistance) {
      const maxDist = parseFloat(maxDistance);
      restaurants = restaurants.filter((r) => {
        if (!r.distance) return false;
        const distMatch = r.distance.match(/(\d+\.?\d*)/);
        return distMatch && parseFloat(distMatch[1]) <= maxDist;
      });
    }

    return successResponse(res, 200, 'Nearby restaurants retrieved successfully', {
      restaurants,
      total: restaurants.length,
      serviceRadiusKm
    });
  } catch (error) {
    console.error('Error fetching nearby restaurants:', error);
    return errorResponse(res, 500, 'Failed to fetch nearby restaurants');
  }
};

// Get restaurant by ID or slug
export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;

    // Build query conditions - only include _id if it's a valid ObjectId
    const queryConditions = {
      isActive: true
    };

    const orConditions = [
      { restaurantId: id },
      { slug: id }];


    // Only add _id condition if the id is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(id) });
    }

    queryConditions.$or = orConditions;

    const restaurant = await Restaurant.findOne(queryConditions).
      select('-owner -createdAt -updatedAt').
      lean();

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    return successResponse(res, 200, 'Restaurant retrieved successfully', {
      restaurant
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurant');
  }
};
// Get restaurant by owner (for restaurant module)
export const getRestaurantByOwner = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;

    // Fetch as Mongoose document to allow updates in checkSubscriptionExpiry
    let restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Check for subscription expiry and auto-downgrade if needed
    restaurant = await checkSubscriptionExpiry(restaurant);

    let daysRemaining = null;
    let showWarning = false;
    let warningDays = 5;

    if (restaurant.businessModel === 'Subscription Base' && restaurant.subscription?.status === 'active') {
      const now = new Date();
      const endDate = new Date(restaurant.subscription.endDate);
      const diffTime = endDate - now;
      daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      try {
        const settings = await BusinessSettings.getSettings();
        warningDays = settings?.subscriptionExpiryWarningDays || 5;
      } catch (settingsError) {
        console.error('Error fetching subscription warning days:', settingsError);
      }

      if (daysRemaining <= warningDays) {
        showWarning = true;
      }
    }

    const restaurantData = restaurant.toObject ? restaurant.toObject() : restaurant;
    restaurantData.subscriptionStatus = {
      daysRemaining,
      showWarning,
      warningDays
    };

    return successResponse(res, 200, 'Restaurant retrieved successfully', {
      restaurant: restaurantData
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurant');
  }
};

// Create/Update restaurant from onboarding data
export const createRestaurantFromOnboarding = async (onboardingData, restaurantId) => {
  try {
    const { step1, step2, step4 } = onboardingData;

    if (!step1 || !step2) {
      throw new Error('Incomplete onboarding data: Missing step1 or step2');
    }

    // Validate required fields
    if (!step1.restaurantName) {
      throw new Error('Restaurant name is required');
    }

    // Find existing restaurant
    const existing = await Restaurant.findById(restaurantId);

    if (!existing) {
      throw new Error('Restaurant not found');
    }

    // Generate slug from restaurant name
    let baseSlug = step1.restaurantName.
      toLowerCase().
      replace(/[^a-z0-9]+/g, '-').
      replace(/(^-|-$)/g, '');

    // Check if slug needs to be unique (if it's different from existing)
    let slug = baseSlug;
    if (existing.slug !== baseSlug) {
      // Check if the new slug already exists for another restaurant
      const existingBySlug = await Restaurant.findOne({ slug: baseSlug, _id: { $ne: existing._id } });
      if (existingBySlug) {
        // Make slug unique by appending a number
        let counter = 1;
        let uniqueSlug = `${baseSlug}-${counter}`;
        while (await Restaurant.findOne({ slug: uniqueSlug, _id: { $ne: existing._id } })) {
          counter++;
          uniqueSlug = `${baseSlug}-${counter}`;
        }
        slug = uniqueSlug;

      }
    } else {
      slug = existing.slug; // Keep existing slug
    }

    // Update existing restaurant with latest onboarding data
    existing.name = step1.restaurantName || existing.name;
    existing.slug = slug;
    existing.ownerName = step1.ownerName || existing.ownerName;
    existing.ownerEmail = step1.ownerEmail || existing.ownerEmail;
    existing.ownerPhone = step1.ownerPhone || existing.ownerPhone;
    existing.primaryContactNumber = step1.primaryContactNumber || existing.primaryContactNumber;
    if (step1.location) existing.location = step1.location;

    // Update step2 data - always update even if empty arrays
    if (step2) {
      if (step2.profileImageUrl) {
        existing.profileImage = step2.profileImageUrl;
      }
      if (step2.menuImageUrls) {
        existing.menuImages = step2.menuImageUrls; // Update even if empty array
      }
      if (step2.cuisines) {
        existing.cuisines = step2.cuisines; // Update even if empty array
      }
      if (step2.deliveryTimings) {
        existing.deliveryTimings = step2.deliveryTimings;
      }
      if (step2.openDays) {
        existing.openDays = step2.openDays; // Update even if empty array
      }
    }

    // Update step4 data if available
    if (step4) {
      if (step4.estimatedDeliveryTime) existing.estimatedDeliveryTime = step4.estimatedDeliveryTime;
      if (step4.distance) existing.distance = step4.distance;
      if (step4.priceRange) existing.priceRange = step4.priceRange;
      if (step4.featuredDish) existing.featuredDish = step4.featuredDish;
      if (step4.featuredPrice !== undefined) existing.featuredPrice = step4.featuredPrice;
      if (step4.offer) existing.offer = step4.offer;
    }

    try {
      await existing.save();
    } catch (saveError) {
      if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.slug) {
        // Slug conflict - try to make it unique
        let counter = 1;
        let uniqueSlug = `${slug}-${counter}`;
        while (await Restaurant.findOne({ slug: uniqueSlug, _id: { $ne: existing._id } })) {
          counter++;
          uniqueSlug = `${slug}-${counter}`;
        }
        existing.slug = uniqueSlug;
        await existing.save();

      } else {
        throw saveError;
      }
    }






    return existing;

  } catch (error) {
    console.error('Error creating restaurant from onboarding:', error);
    console.error('Error stack:', error.stack);
    console.error('Onboarding data received:', {
      hasStep1: !!onboardingData?.step1,
      hasStep2: !!onboardingData?.step2,
      step1Keys: onboardingData?.step1 ? Object.keys(onboardingData.step1) : [],
      step2Keys: onboardingData?.step2 ? Object.keys(onboardingData.step2) : []
    });
    throw error;
  }
};

/**
 * Update restaurant profile
 * PUT /api/restaurant/profile
 */
export const updateRestaurantProfile = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { profileImage, menuImages, name, cuisines, location, ownerName, ownerEmail, ownerPhone } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const updateData = {};

    // Update profile image if provided
    if (profileImage) {
      updateData.profileImage = profileImage;
    }

    // Update menu images if provided
    if (menuImages !== undefined) {
      updateData.menuImages = menuImages;
    }

    // Update name if provided
    if (name) {
      updateData.name = name;
      // Regenerate slug if name changed
      if (name !== restaurant.name) {
        let baseSlug = name.
          toLowerCase().
          replace(/[^a-z0-9]+/g, '-').
          replace(/(^-|-$)/g, '');

        // Check if slug already exists for another restaurant
        let slug = baseSlug;
        const existingBySlug = await Restaurant.findOne({ slug: baseSlug, _id: { $ne: restaurantId } });
        if (existingBySlug) {
          let counter = 1;
          let uniqueSlug = `${baseSlug}-${counter}`;
          while (await Restaurant.findOne({ slug: uniqueSlug, _id: { $ne: restaurantId } })) {
            counter++;
            uniqueSlug = `${baseSlug}-${counter}`;
          }
          slug = uniqueSlug;
        }
        updateData.slug = slug;
      }
    }

    // Update cuisines if provided
    if (cuisines !== undefined) {
      updateData.cuisines = cuisines;
    }

    // Update location if provided
    if (location) {
      // Ensure coordinates array is set if latitude/longitude exist
      if (location.latitude && location.longitude && !location.coordinates) {
        location.coordinates = [location.longitude, location.latitude]; // GeoJSON format: [lng, lat]
      }

      // If coordinates array exists but no lat/lng, extract them
      if (location.coordinates && Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
        if (!location.longitude) location.longitude = location.coordinates[0];
        if (!location.latitude) location.latitude = location.coordinates[1];
      }

      updateData.location = location;
    }

    // Update owner details if provided
    if (ownerName !== undefined) {
      updateData.ownerName = ownerName;
    }
    if (ownerEmail !== undefined) {
      updateData.ownerEmail = ownerEmail;
    }
    if (ownerPhone !== undefined) {
      updateData.ownerPhone = ownerPhone;
    }

    // Update dining platform fee if provided
    if (req.body.diningPlatformFee !== undefined) {
      updateData.diningPlatformFee = req.body.diningPlatformFee;
    }

    // Update restaurant
    Object.assign(restaurant, updateData);
    await restaurant.save();

    return successResponse(res, 200, 'Restaurant profile updated successfully', {
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        slug: restaurant.slug,
        profileImage: restaurant.profileImage,
        menuImages: restaurant.menuImages,
        cuisines: restaurant.cuisines,
        location: restaurant.location,
        ownerName: restaurant.ownerName,
        ownerEmail: restaurant.ownerEmail,
        ownerPhone: restaurant.ownerPhone
      }
    });
  } catch (error) {
    console.error('❌ Error updating restaurant profile:', error);
    if (error.name === 'ValidationError') {
      return errorResponse(res, 400, Object.values(error.errors).map(e => e.message).join(', '));
    }
    return errorResponse(res, 500, 'Failed to update restaurant profile: ' + error.message);
  }
});

/**
 * Update restaurant payout details (Bank, UPI, QR)
 * PUT /api/restaurant/payout-details
 */
export const updatePayoutDetails = asyncHandler(async (req, res) => {
  // console.log('🚀 [CONTROLLER] updatePayoutDetails called');
  try {
    const restaurantId = req.restaurant._id;
    const { bank, upiId, qrCode } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    if (!restaurant.onboarding) {
      restaurant.onboarding = { step1: {}, step2: {}, step3: {}, step4: {} };
    }
    if (!restaurant.onboarding.step3) {
      restaurant.onboarding.step3 = {};
    }
    if (!restaurant.onboarding.step3.bank) {
      restaurant.onboarding.step3.bank = {};
    }

    // Update bank details if provided
    if (bank) {
      if (bank.accountNumber) restaurant.onboarding.step3.bank.accountNumber = bank.accountNumber;
      if (bank.ifscCode) restaurant.onboarding.step3.bank.ifscCode = bank.ifscCode;
      if (bank.accountHolderName) restaurant.onboarding.step3.bank.accountHolderName = bank.accountHolderName;
      if (bank.accountType) restaurant.onboarding.step3.bank.accountType = bank.accountType;
    }

    // Update UPI ID if provided
    if (upiId !== undefined) {
      restaurant.onboarding.step3.bank.upiId = upiId;
    }

    // Update QR Code if provided
    if (qrCode) {
      restaurant.onboarding.step3.bank.qrCode = qrCode;
    }

    await restaurant.save();

    return successResponse(res, 200, 'Payout details updated successfully', {
      payoutDetails: restaurant.onboarding.step3.bank
    });
  } catch (error) {
    console.error('Error updating payout details:', error);
    return errorResponse(res, 500, 'Failed to update payout details');
  }
});

/**
 * Upload restaurant profile image
 * POST /api/restaurant/profile/image
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/restaurant/profile';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'fill', gravity: 'auto' },
        { quality: 'auto' }
      ]
    });

    // Update restaurant profile image
    restaurant.profileImage = {
      url: result.secure_url,
      publicId: result.public_id
    };
    await restaurant.save();

    return successResponse(res, 200, 'Profile image uploaded successfully', {
      profileImage: restaurant.profileImage
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return errorResponse(res, 500, 'Failed to upload profile image');
  }
});

/**
 * Upload restaurant menu image
 * POST /api/restaurant/profile/menu-image
 */
export const uploadMenuImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 400, 'No image file provided');
    }

    // Validate file buffer
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return errorResponse(res, 400, 'File buffer is empty or invalid');
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (req.file.size > maxSize) {
      return errorResponse(res, 400, `File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return errorResponse(res, 400, `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // Initialize Cloudinary if not already initialized
    await initializeCloudinary();

    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Upload to Cloudinary
    const folder = 'appzeto/restaurant/menu';
    const result = await uploadToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      transformation: [
        { width: 1200, height: 800, crop: 'fill', gravity: 'auto' },
        { quality: 'auto' }
      ]
    });

    // Replace first menu image (main banner) or add if none exists
    if (!restaurant.menuImages) {
      restaurant.menuImages = [];
    }

    // Replace the first menu image (main banner) instead of adding a new one
    const newMenuImage = {
      url: result.secure_url,
      publicId: result.public_id
    };

    if (restaurant.menuImages.length > 0) {
      // Replace the first image (main banner)
      restaurant.menuImages[0] = newMenuImage;
    } else {
      // Add as first image if array is empty
      restaurant.menuImages.push(newMenuImage);
    }

    await restaurant.save();

    return successResponse(res, 200, 'Menu image uploaded successfully', {
      menuImage: {
        url: result.secure_url,
        publicId: result.public_id
      },
      menuImages: restaurant.menuImages
    });
  } catch (error) {
    console.error('❌ Error uploading menu image:', {
      message: error.message,
      stack: error.stack,
      errorType: error.constructor.name,
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      bufferSize: req.file?.buffer?.length,
      restaurantId: req.restaurant?._id,
      cloudinaryError: error.http_code || error.name === 'Error' ? error.message : null
    });

    // Provide more specific error message
    let errorMessage = 'Failed to upload menu image';
    if (error.message) {
      errorMessage += `: ${error.message}`;
    } else if (error.http_code) {
      errorMessage += `: Cloudinary error (${error.http_code})`;
    }

    return errorResponse(res, 500, errorMessage);
  }
});

/**
 * Update restaurant delivery status (isAcceptingOrders)
 * PUT /api/restaurant/delivery-status
 */
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { isAcceptingOrders } = req.body;

    if (typeof isAcceptingOrders !== 'boolean') {
      return errorResponse(res, 400, 'isAcceptingOrders must be a boolean value');
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { isAcceptingOrders },
      { new: true }
    ).select('-password');

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    return successResponse(res, 200, 'Delivery status updated successfully', {
      restaurant: {
        id: restaurant._id,
        isAcceptingOrders: restaurant.isAcceptingOrders
      }
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return errorResponse(res, 500, 'Failed to update delivery status');
  }
});

/**
 * Delete restaurant account
 * DELETE /api/restaurant/profile
 */
export const deleteRestaurantAccount = asyncHandler(async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    /*
    console.info('[Restaurant Delete] Request received', {
      restaurantId: restaurantId?.toString?.() || restaurantId,
      path: req.originalUrl,
      method: req.method
    });
    */
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      // console.warn('[Restaurant Delete] Restaurant not found');
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Delete Cloudinary images if they exist
    try {
      // Delete profile image
      if (restaurant.profileImage?.publicId) {
        try {
          await deleteFromCloudinary(restaurant.profileImage.publicId);
        } catch (error) {
          console.error('Error deleting profile image from Cloudinary:', error);
        }
      }

      // Delete menu images
      if (restaurant.menuImages && Array.isArray(restaurant.menuImages)) {
        for (const menuImage of restaurant.menuImages) {
          if (menuImage?.publicId) {
            try {
              await deleteFromCloudinary(menuImage.publicId);
            } catch (error) {
              console.error('Error deleting menu image from Cloudinary:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error deleting images from Cloudinary:', error);
    }

    // Delete the restaurant from database
    await Restaurant.findByIdAndDelete(restaurantId);
    console.info('[Restaurant Delete] Restaurant deleted successfully', {
      restaurantId: restaurantId?.toString?.() || restaurantId,
      restaurantName: restaurant?.name || ''
    });

    return successResponse(res, 200, 'Restaurant account deleted successfully');
  } catch (error) {
    console.error('Error deleting restaurant account:', error);
    return errorResponse(res, 500, 'Failed to delete restaurant account');
  }
});

/**
 * Get restaurants with dishes under ₹250
 */
export const getRestaurantsWithDishesUnder250 = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const MAX_PRICE = 250;

    const getFinalPrice = (item) => {
      if (item.originalPrice && item.discountAmount && item.discountAmount > 0) {
        let discountedPrice = item.originalPrice;
        if (item.discountType === 'Percent') {
          discountedPrice = item.originalPrice - item.originalPrice * item.discountAmount / 100;
        } else if (item.discountType === 'Fixed') {
          discountedPrice = item.originalPrice - item.discountAmount;
        }
        return Math.max(0, discountedPrice);
      }
      return Math.max(0, item.price || 0);
    };

    const filterItemsUnder250 = (items) => {
      return items.filter((item) => {
        if (item.isAvailable === false) return false;
        const finalPrice = getFinalPrice(item);
        return finalPrice <= MAX_PRICE;
      });
    };

    const processRestaurant = async (restaurant) => {
      try {
        const menu = await Menu.findOne({
          restaurant: restaurant._id,
          isActive: true
        }).lean();

        if (!menu || !menu.sections || menu.sections.length === 0) {
          return null;
        }

        const dishesUnder250 = [];

        menu.sections.forEach((section) => {
          if (section.isEnabled === false) return;

          const sectionItems = filterItemsUnder250(section.items || []);
          dishesUnder250.push(...sectionItems.map((item) => ({
            ...item,
            sectionName: section.name
          })));

          (section.subsections || []).forEach((subsection) => {
            const subsectionItems = filterItemsUnder250(subsection.items || []);
            dishesUnder250.push(...subsectionItems.map((item) => ({
              ...item,
              sectionName: section.name,
              subsectionName: subsection.name
            })));
          });
        });

        if (dishesUnder250.length > 0) {
          return {
            id: restaurant._id.toString(),
            isActive: restaurant.isActive,
            restaurantId: restaurant.restaurantId,
            name: restaurant.name,
            slug: restaurant.slug,
            rating: restaurant.rating || 0,
            totalRatings: restaurant.totalRatings || 0,
            deliveryTime: restaurant.estimatedDeliveryTime || "25-30 mins",
            distance: restaurant.distance || "1.2 km",
            cuisine: restaurant.cuisines && restaurant.cuisines.length > 0 ?
              restaurant.cuisines.join(' • ') :
              "Multi-cuisine",
            price: restaurant.priceRange || "$$",
            image: restaurant.profileImage?.url || restaurant.menuImages?.[0]?.url || "",
            menuItems: dishesUnder250.map((item) => ({
              id: item.id,
              name: item.name,
              price: getFinalPrice(item),
              originalPrice: item.originalPrice || item.price,
              image: item.image || (item.images && item.images.length > 0 ? item.images[0] : ""),
              isVeg: item.foodType === 'Veg',
              bestPrice: item.discountAmount > 0 || item.originalPrice && item.originalPrice > getFinalPrice(item),
              description: item.description || "",
              category: item.category || item.sectionName || ""
            }))
          };
        }
        return null;
      } catch (error) {
        console.error(`Error processing restaurant ${restaurant._id}:`, error);
        return null;
      }
    };

    const coords = getGeoCoordinates({ ...req.query, ...req.body, lat, lng });
    if (!coords) {
      return successResponse(res, 200, 'Location coordinates are required to list nearby restaurants', {
        restaurants: [],
        total: 0,
        locationRequired: true
      });
    }

    const restaurantQuery = { isActive: true };
    await backfillGeoLocationForRestaurants();
    const settings = await ServiceSettings.getSettings();
    const serviceRadiusKm = Number(settings?.serviceRadiusKm) || 10;
    restaurantQuery.geoLocation = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coords.lng, coords.lat]
        },
        $maxDistance: serviceRadiusKm * 1000
      }
    };

    let restaurants = await Restaurant.find(restaurantQuery)
      .select('-owner -createdAt -updatedAt')
      .lean()
      .limit(100);

    const batchSize = 10;
    const restaurantsWithDishes = [];

    for (let i = 0; i < restaurants.length; i += batchSize) {
      const batch = restaurants.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processRestaurant));
      restaurantsWithDishes.push(...results.filter((r) => r !== null));
    }

    restaurantsWithDishes.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.menuItems.length - a.menuItems.length;
    });

    return successResponse(res, 200, 'Restaurants with dishes under ₹250 retrieved successfully', {
      restaurants: restaurantsWithDishes,
      total: restaurantsWithDishes.length
    });
  } catch (error) {
    console.error('Error fetching restaurants with dishes under ₹250:', error);
    return errorResponse(res, 500, 'Failed to fetch restaurants with dishes under ₹250');
  }
};

/**
 * Update restaurant dining settings (slots and discounts)
 */
export const updateDiningSettings = asyncHandler(async (req, res) => {
  const { diningSlots, diningGuests, diningEnabled } = req.body;

  const restaurant = await Restaurant.findById(req.restaurant._id || req.user?._id);
  if (!restaurant) {
    return errorResponse(res, 404, 'Restaurant not found');
  }

  const isManagingDiningData = diningSlots !== undefined || diningGuests !== undefined;
  if (isManagingDiningData && !restaurant.diningEnabled) {
    return errorResponse(res, 403, 'Dining features are available only after successful activation');
  }

  if (diningSlots) restaurant.diningSlots = diningSlots;
  if (diningGuests !== undefined) restaurant.diningGuests = diningGuests;

  if (diningEnabled !== undefined) {
    const isTryingToEnable = Boolean(diningEnabled);
    const isCommissionBased = String(restaurant.businessModel || '').toLowerCase().includes('commission');
    const isPaymentCompleted = restaurant.diningStatus === 'Payment Successful';
    const isTryingToEnableWithoutPayment =
      isTryingToEnable && isCommissionBased && !restaurant.diningActivationPaid;

    if (isTryingToEnableWithoutPayment) {
      return errorResponse(res, 403, 'Complete dining activation payment before enabling dining');
    }

    if (isTryingToEnable && !isPaymentCompleted) {
      return errorResponse(res, 403, 'Dining can be enabled only after approval and payment completion');
    }

    restaurant.diningEnabled = diningEnabled;
  }

  await restaurant.save();

  return successResponse(res, 200, 'Dining settings updated successfully', {
    diningSlots: restaurant.diningSlots,
    diningGuests: restaurant.diningGuests,
    diningEnabled: restaurant.diningEnabled
  });
});

