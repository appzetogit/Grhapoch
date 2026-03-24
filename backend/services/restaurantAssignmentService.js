import Restaurant from '../models/Restaurant.js';
import ServiceSettings from '../models/ServiceSettings.js';

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in kilometers
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
 * Find nearest restaurant based on delivery location
 * @param {number} deliveryLat - Delivery latitude
 * @param {number} deliveryLng - Delivery longitude
 * @param {Array} orderItems - Order items (to check restaurant availability)
 * @returns {Object|null} Nearest restaurant or null
 */
export async function findNearestRestaurant(deliveryLat, deliveryLng, orderItems = []) {
  try {
    // Validate coordinates
    if (!deliveryLat || !deliveryLng ||
    typeof deliveryLat !== 'number' || typeof deliveryLng !== 'number' ||
    deliveryLat < -90 || deliveryLat > 90 ||
    deliveryLng < -180 || deliveryLng > 180) {
      throw new Error('Invalid delivery coordinates');
    }

    const settings = await ServiceSettings.getSettings();
    const serviceRadiusKm = Number(settings?.serviceRadiusKm) || 10;

    const restaurantQuery = {
      isActive: true,
      isAcceptingOrders: true,
      geoLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [deliveryLng, deliveryLat]
          },
          $maxDistance: serviceRadiusKm * 1000
        }
      }
    };

    const restaurants = await Restaurant.find(restaurantQuery).lean();
    if (!restaurants || restaurants.length === 0) {
      return null;
    }

    const nearest = restaurants[0];
    const restaurantLat = nearest.location?.latitude || nearest.location?.coordinates?.[1] || nearest.geoLocation?.coordinates?.[1];
    const restaurantLng = nearest.location?.longitude || nearest.location?.coordinates?.[0] || nearest.geoLocation?.coordinates?.[0];
    const distance = (Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng)) ?
      calculateDistance(deliveryLat, deliveryLng, restaurantLat, restaurantLng) :
      null;

    return {
      restaurant: nearest,
      restaurantId: nearest._id?.toString() || nearest.restaurantId,
      zoneId: null,
      zoneName: null,
      distance: distance,
      assignedBy: 'geo_near'
    };
  } catch (error) {
    console.error('Error finding nearest restaurant:', error);
    throw error;
  }
}

/**
 * Assign order to nearest restaurant
 * @param {Object} orderData - Order data including delivery location
 * @returns {Object} Updated order data with assigned restaurant
 */
export async function assignOrderToNearestRestaurant(orderData) {
  try {
    const deliveryLocation = orderData.address?.location?.coordinates ||
    [orderData.address?.location?.longitude || 0,
    orderData.address?.location?.latitude || 0];

    const deliveryLat = deliveryLocation[1] || orderData.address?.location?.latitude;
    const deliveryLng = deliveryLocation[0] || orderData.address?.location?.longitude;

    if (!deliveryLat || !deliveryLng) {
      throw new Error('Delivery location coordinates are required');
    }

    const nearestRestaurant = await findNearestRestaurant(
      deliveryLat,
      deliveryLng,
      orderData.items || []
    );

    if (!nearestRestaurant) {
      throw new Error('No available restaurant found for this delivery location');
    }

    return {
      ...orderData,
      restaurantId: nearestRestaurant.restaurantId,
      restaurantName: nearestRestaurant.restaurant.name || 'Unknown Restaurant',
      assignedRestaurant: {
        restaurantId: nearestRestaurant.restaurantId,
        distance: nearestRestaurant.distance,
        assignedBy: nearestRestaurant.assignedBy,
        zoneId: nearestRestaurant.zoneId || null,
        zoneName: nearestRestaurant.zoneName || null
      }
    };
  } catch (error) {
    console.error('Error assigning order to restaurant:', error);
    throw error;
  }
}
