import ServiceSettings from '../models/ServiceSettings.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * Get Service Settings (Admin)
 * GET /api/admin/service-settings
 */
export const getServiceSettings = asyncHandler(async (req, res) => {
  try {
    const settings = await ServiceSettings.getSettings();
    return successResponse(res, 200, 'Service settings retrieved successfully', settings);
  } catch (error) {
    console.error('Error fetching service settings:', error);
    return errorResponse(res, 500, 'Failed to fetch service settings');
  }
});

/**
 * Update Service Settings (Admin)
 * PUT /api/admin/service-settings
 */
export const updateServiceSettings = asyncHandler(async (req, res) => {
  try {
    const {
      serviceRadiusKm,
      serviceRadius,
      baseDistance,
      baseFee,
      perKmCharge,
      maxServiceDistance
    } = req.body;

    let settings = await ServiceSettings.findOne();
    if (!settings) {
      settings = new ServiceSettings();
    }

    const radiusInput = serviceRadiusKm !== undefined ? serviceRadiusKm : serviceRadius;
    if (radiusInput !== undefined) {
      const radiusNumber = Number(radiusInput);
      if (!Number.isFinite(radiusNumber) || radiusNumber < 0) {
        return errorResponse(res, 400, 'serviceRadiusKm must be a non-negative number');
      }
      settings.serviceRadiusKm = radiusNumber;
    }

    if (baseDistance !== undefined) {
      const baseDistanceNumber = Number(baseDistance);
      if (!Number.isFinite(baseDistanceNumber) || baseDistanceNumber < 0) {
        return errorResponse(res, 400, 'baseDistance must be a non-negative number');
      }
      settings.baseDistance = baseDistanceNumber;
    }

    if (baseFee !== undefined) {
      const baseFeeNumber = Number(baseFee);
      if (!Number.isFinite(baseFeeNumber) || baseFeeNumber < 0) {
        return errorResponse(res, 400, 'baseFee must be a non-negative number');
      }
      settings.baseFee = baseFeeNumber;
    }

    if (perKmCharge !== undefined) {
      const perKmChargeNumber = Number(perKmCharge);
      if (!Number.isFinite(perKmChargeNumber) || perKmChargeNumber < 0) {
        return errorResponse(res, 400, 'perKmCharge must be a non-negative number');
      }
      settings.perKmCharge = perKmChargeNumber;
    }

    if (maxServiceDistance !== undefined) {
      if (maxServiceDistance === null || maxServiceDistance === '') {
        settings.maxServiceDistance = null;
      } else {
        const maxDistanceNumber = Number(maxServiceDistance);
        if (!Number.isFinite(maxDistanceNumber) || maxDistanceNumber < 0) {
          return errorResponse(res, 400, 'maxServiceDistance must be a non-negative number');
        }
        settings.maxServiceDistance = maxDistanceNumber;
      }
    }

    if (settings.maxServiceDistance !== null &&
      settings.maxServiceDistance !== undefined &&
      settings.baseDistance !== undefined &&
      settings.maxServiceDistance < settings.baseDistance) {
      return errorResponse(res, 400, 'maxServiceDistance must be >= baseDistance');
    }

    await settings.save();

    return successResponse(res, 200, 'Service settings updated successfully', settings);
  } catch (error) {
    console.error('Error updating service settings:', error);
    return errorResponse(res, 500, 'Failed to update service settings');
  }
});
