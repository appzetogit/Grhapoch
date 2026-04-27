import { asyncHandler } from '../middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../utils/response.js';
import Delivery from '../models/Delivery.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import mongoose from 'mongoose';
import { validate } from '../middleware/validate.js';
import Joi from 'joi';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Delivery Partner Profile
 * GET /api/delivery/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery; // From authenticate middleware

    // Populate related fields if needed
    const profile = await Delivery.findById(delivery._id)
      .select('-password -refreshToken')
      .lean();

    if (!profile) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    return successResponse(res, 200, 'Profile retrieved successfully', {
      profile
    });
  } catch (error) {
    logger.error(`Error fetching delivery profile: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch profile');
  }
});

/**
 * Update Delivery Partner Profile
 * PUT /api/delivery/profile
 */
const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  email: Joi.string().email().lowercase().trim().optional().allow(null, ''),
  dateOfBirth: Joi.date().optional().allow(null),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer-not-to-say').optional(),
  vehicle: Joi.object({
    type: Joi.string().valid('bike', 'scooter', 'bicycle', 'car').optional(),
    number: Joi.string().trim().optional().allow(null, ''),
    model: Joi.string().trim().optional().allow(null, ''),
    brand: Joi.string().trim().optional().allow(null, ''),
    name: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  location: Joi.object({
    addressLine1: Joi.string().trim().optional().allow(null, ''),
    addressLine2: Joi.string().trim().optional().allow(null, ''),
    area: Joi.string().trim().optional().allow(null, ''),
    city: Joi.string().trim().optional().allow(null, ''),
    state: Joi.string().trim().optional().allow(null, ''),
    zipCode: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  profileImage: Joi.object({
    url: Joi.string().uri().optional().allow(null, ''),
    publicId: Joi.string().trim().optional().allow(null, '')
  }).optional(),
  documents: Joi.object({
    aadhar: Joi.object({
      number: Joi.string().trim().optional().allow(null, ''),
      document: Joi.string().uri().optional().allow(null, ''),
      verified: Joi.boolean().optional()
    }).optional(),
    pan: Joi.object({
      number: Joi.string().trim().optional().allow(null, ''),
      document: Joi.string().uri().optional().allow(null, ''),
      verified: Joi.boolean().optional()
    }).optional(),
    drivingLicense: Joi.object({
      number: Joi.string().trim().optional().allow(null, ''),
      document: Joi.string().uri().optional().allow(null, ''),
      verified: Joi.boolean().optional(),
      expiryDate: Joi.date().optional().allow(null)
    }).optional(),
    vehicleRC: Joi.object({
      number: Joi.string().trim().optional().allow(null, ''),
      document: Joi.string().uri().optional().allow(null, ''),
      verified: Joi.boolean().optional()
    }).optional(),
    photo: Joi.string().uri().optional().allow(null, ''),
    bankDetails: Joi.object({
      accountHolderName: Joi.string().trim().min(2).max(100).optional().allow(null, ''),
      accountNumber: Joi.string().trim().min(9).max(18).optional().allow(null, ''),
      ifscCode: Joi.string().trim().length(11).uppercase().optional().allow(null, ''),
      bankName: Joi.string().trim().min(2).max(100).optional().allow(null, '')
    }).optional(),
    upiId: Joi.string().trim().optional().allow(null, ''),
    qrCode: Joi.object({
      url: Joi.string().uri().optional().allow(null, ''),
      publicId: Joi.string().trim().optional().allow(null, '')
    }).optional().allow(null)
  }).optional()
});

export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const updateData = req.body;

    // Validate input
    const { error } = updateProfileSchema.validate(updateData);
    if (error) {
      return errorResponse(res, 400, error.details[0].message);
    }

    // Handle nested documents updates properly
    const setData = { ...updateData };
    if (updateData.documents) {
      // Map nested document fields using dot notation for $set
      const docFields = ['aadhar', 'pan', 'drivingLicense', 'vehicleRC', 'bankDetails', 'upiId', 'qrCode', 'photo'];
      
      docFields.forEach(field => {
        if (updateData.documents[field] !== undefined) {
          if (typeof updateData.documents[field] === 'object' && updateData.documents[field] !== null && !Array.isArray(updateData.documents[field])) {
            // Further nesting for specific fields like verified
            Object.keys(updateData.documents[field]).forEach(subField => {
              setData[`documents.${field}.${subField}`] = updateData.documents[field][subField];
            });
          } else {
            setData[`documents.${field}`] = updateData.documents[field];
          }
        }
      });
      
      delete setData.documents;
    }

    // Update profile
    const updatedDelivery = await Delivery.findByIdAndUpdate(
      delivery._id,
      { $set: setData },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!updatedDelivery) {
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    logger.info('Profile updated successfully', {
      deliveryId: updatedDelivery.deliveryId || updatedDelivery._id,
      updatedFields: Object.keys(updateData)
    });

    return successResponse(res, 200, 'Profile updated successfully', {
      profile: updatedDelivery
    });
  } catch (error) {
    logger.error(`Error updating delivery profile: ${error.message}`);

    // Handle duplicate email error
    if (error.code === 11000) {
      return errorResponse(res, 400, 'Email already exists');
    }

    return errorResponse(res, 500, 'Failed to update profile');
  }
});

/**
 * Reverify Delivery Partner (Resubmit for approval)
 * POST /api/delivery/reverify
 */
export const reverify = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;

    if (delivery.status !== 'blocked') {
      return errorResponse(res, 400, 'Only rejected delivery partners can resubmit for verification');
    }

    // Reset to pending status and clear rejection details
    delivery.status = 'pending';
    delivery.isActive = true; // Allow login to see verification message
    delivery.rejectionReason = undefined;
    delivery.rejectedAt = undefined;
    delivery.rejectedBy = undefined;

    await delivery.save();

    logger.info(`Delivery partner resubmitted for verification: ${delivery._id}`, {
      deliveryId: delivery.deliveryId
    });

    return successResponse(res, 200, 'Request resubmitted for verification successfully', {
      profile: {
        _id: delivery._id.toString(),
        name: delivery.name,
        status: delivery.status
      }
    });
  } catch (error) {
    logger.error(`Error reverifying delivery partner: ${error.message}`);
    return errorResponse(res, 500, 'Failed to resubmit for verification');
  }
});


/**
 * Delete Delivery Partner Account
 * DELETE /api/delivery/profile/account
 */
export const deleteDeliveryAccount = asyncHandler(async (req, res) => {
  const deliveryId = req.delivery._id;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Delete DeliveryWallet
    await DeliveryWallet.findOneAndDelete({ deliveryId }, { session });

    // Delete Delivery Partner
    const deleted = await Delivery.findByIdAndDelete(deliveryId, { session });

    if (!deleted) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, 404, 'Delivery partner not found');
    }

    await session.commitTransaction();
    session.endSession();

    logger.info(`Delivery partner account deleted: ${deliveryId}`);
    return successResponse(res, 200, 'Delivery partner account deleted successfully');
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error(`Error deleting delivery partner account: ${error.message}`);
    return errorResponse(res, 500, 'Failed to delete delivery partner account');
  }
});
