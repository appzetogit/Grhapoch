import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Filter delivery partners who can accept a COD order of this amount
 */
async function filterCodEligiblePartners(partners, amount) {
  if (!partners || partners.length === 0) return [];
  
  const results = [];
  for (const partner of partners) {
    try {
      const WalletModel = (await import('../models/DeliveryWallet.js')).default;
      const wallet = await WalletModel.findOne({ deliveryPartnerId: partner._id });
      
      const totalCashLimit = Number(wallet?.totalCashLimit ?? wallet?.cashLimit ?? 0);
      const cashInHand = Number(wallet?.cashInHand || 0);
      const availableCashLimit = Math.max(0, totalCashLimit - cashInHand);
      
      if (availableCashLimit >= amount) {
        results.push(partner);
      }
    } catch (e) {
      console.error('Error checking wallet for COD eligibility:', e);
      // Default to true if wallet check fails to not block delivery
      results.push(partner);
    }
  }
  return results;
}

/**
 * Find all nearest available delivery boys within priority distance (for priority notification)
 */
export async function findNearestDeliveryBoys(restaurantLat, restaurantLng, restaurantId = null, priorityDistance = 5, limit = null, isCod = false, codAmount = 0) {
  try {
    let deliveryQuery = {
      'availability.isOnline': true,
      status: { $in: ['approved', 'active'] },
      isActive: { $ne: false },
      'availability.currentLocation.coordinates': { $exists: true }
    };

    deliveryQuery['availability.currentLocation'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [restaurantLng, restaurantLat]
        },
        $maxDistance: priorityDistance * 1000
      }
    };

    const deliveryPartners = await Delivery.find(deliveryQuery)
      .select('_id name phone availability.currentLocation availability.isOnline status isActive zoneId')
      .lean();

    console.log(`[findNearestDeliveryBoys] Found ${deliveryPartners.length} partners. IDs: ${deliveryPartners.map(p => p._id).join(', ')}. Names: ${deliveryPartners.map(p => p.name).join(', ')}`);

    const deliveryPartnersWithDistance = deliveryPartners.map((partner) => {
      const location = partner.availability?.currentLocation;
      if (!location || !location.coordinates || location.coordinates.length < 2) {
        return null;
      }

      const [lng, lat] = location.coordinates;
      if (lat === 0 && lng === 0) {
        return null;
      }

      const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);
      return {
        ...partner,
        deliveryPartnerId: partner._id,
        distance,
        latitude: lat,
        longitude: lng,
        zoneId: partner.zoneId || null
      };
    }).filter((partner) => partner !== null && partner.distance <= priorityDistance);

    let filteredPartners = deliveryPartnersWithDistance;
    if (isCod) {
      filteredPartners = await filterCodEligiblePartners(deliveryPartnersWithDistance, codAmount);
    }

    filteredPartners.sort((a, b) => a.distance - b.distance);
    return limit ? filteredPartners.slice(0, limit) : filteredPartners;
  } catch (error) {
    console.error('❌ Error finding nearest delivery boys:', error);
    return [];
  }
}

/**
 * Find the nearest available delivery boy to a restaurant location
 */
export async function findNearestDeliveryBoy(restaurantLat, restaurantLng, restaurantId = null, maxDistance = 50, excludeIds = [], isCod = false, codAmount = 0) {
  try {
    let deliveryQuery = {
      'availability.isOnline': true,
      status: { $in: ['approved', 'active'] },
      isActive: { $ne: false },
      'availability.currentLocation.coordinates': { $exists: true }
    };

    if (excludeIds && excludeIds.length > 0) {
      const excludeObjectIds = excludeIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (excludeObjectIds.length > 0) {
        deliveryQuery._id = { $nin: excludeObjectIds };
      }
    }

    let finalMaxDistance = maxDistance;
    if (maxDistance === 50) {
      try {
        const ServiceSettings = (await import('../models/ServiceSettings.js')).default;
        const settings = await ServiceSettings.getSettings();
        finalMaxDistance = settings.serviceRadiusKm || 10;
      } catch (e) {
        finalMaxDistance = 10;
      }
    }

    deliveryQuery['availability.currentLocation'] = {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [restaurantLng, restaurantLat]
        },
        $maxDistance: finalMaxDistance * 1000
      }
    };

    const deliveryPartners = await Delivery.find(deliveryQuery)
      .select('_id name phone availability.currentLocation availability.isOnline status isActive zoneId')
      .lean();

    console.log(`[findNearestDeliveryBoy] Found ${deliveryPartners.length} partners. IDs: ${deliveryPartners.map(p => p._id).join(', ')}. Names: ${deliveryPartners.map(p => p.name).join(', ')}`);

    const deliveryPartnersWithDistance = deliveryPartners.map((partner) => {
      const location = partner.availability?.currentLocation;
      if (!location || !location.coordinates || location.coordinates.length < 2) {
        return null;
      }

      const [lng, lat] = location.coordinates;
      if (lat === 0 && lng === 0) {
        return null;
      }

      const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);
      return {
        ...partner,
        deliveryPartnerId: partner._id,
        distance,
        latitude: lat,
        longitude: lng,
        zoneId: partner.zoneId || null
      };
    }).filter((partner) => partner !== null && partner.distance <= finalMaxDistance);

    let codEligiblePartners = deliveryPartnersWithDistance;
    if (isCod) {
      codEligiblePartners = await filterCodEligiblePartners(deliveryPartnersWithDistance, codAmount);
    }

    if (codEligiblePartners.length === 0) return null;
    
    codEligiblePartners.sort((a, b) => a.distance - b.distance);
    return codEligiblePartners[0];
  } catch (error) {
    console.error('❌ Error finding nearest delivery boy:', error);
    return null;
  }
}

/**
 * Assign an order to the nearest available delivery boy
 */
export async function assignOrderToDeliveryBoy(order, restaurantLat, restaurantLng, restaurantId = null) {
  try {
    const isCod = order.payment?.method === 'cash' || order.payment?.method === 'cod';
    const codAmount = Number(order.pricing?.total) || 0;
    
    const nearestBoy = await findNearestDeliveryBoy(
      restaurantLat,
      restaurantLng,
      restaurantId,
      50,
      [],
      isCod,
      codAmount
    );

    if (!nearestBoy) return null;

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      {
        $set: {
          deliveryPartnerId: nearestBoy._id,
          'assignmentInfo.assignedAt': new Date(),
          'assignmentInfo.distance': nearestBoy.distance,
          'assignmentInfo.assignedBy': 'auto-assignment'
        }
      },
      { new: true }
    );

    return {
      success: true,
      deliveryPartnerId: nearestBoy._id,
      distance: nearestBoy.distance,
      order: updatedOrder
    };
  } catch (error) {
    console.error('❌ Error assigning order to delivery boy:', error);
    return null;
  }
}
