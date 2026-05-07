import SupportPage from '../models/SupportPage.js';
import { successResponse, errorResponse } from '../utils/response.js';
import asyncHandler from '../middleware/asyncHandler.js';

/**
 * Get Support Page Data (Public)
 * GET /api/support/public
 */
export const getSupportPublic = asyncHandler(async (req, res) => {
  try {
    const support = await SupportPage.findOne({ isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!support) {
      // Return default data if no support exists
      return successResponse(res, 200, 'Support data retrieved successfully', {
        title: 'Support & FAQ',
        description: 'Welcome to support.',
        email: 'support@grhapoch.com',
        phone: '+91 0000000000',
        footerText: 'Our Support Team is available 24/7 to assist you.'
      });
    }

    return successResponse(res, 200, 'Support data retrieved successfully', support);
  } catch (error) {
    console.error('Error fetching support data:', error);
    return errorResponse(res, 500, 'Failed to fetch support data');
  }
});

/**
 * Get Support Page Data (Admin)
 * GET /api/admin/support
 */
export const getSupport = asyncHandler(async (req, res) => {
  try {
    let support = await SupportPage.findOne({}).lean();

    if (!support) {
      // Create default support if it doesn't exist
      support = await SupportPage.create({
        title: 'Support & FAQ',
        description: 'Welcome to support.',
        email: 'support@grhapoch.com',
        phone: '+91 0000000000',
        footerText: 'Our Support Team is available 24/7 to assist you.',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Support data retrieved successfully', support);
  } catch (error) {
    console.error('Error fetching support data:', error);
    return errorResponse(res, 500, 'Failed to fetch support data');
  }
});

/**
 * Update Support Page Data
 * PUT /api/admin/support
 */
export const updateSupport = asyncHandler(async (req, res) => {
  try {
    const { title, description, email, phone, footerText, isActive } = req.body;

    // Validate required fields
    if (!email || !phone) {
      return errorResponse(res, 400, 'Email and phone are required');
    }

    // Find existing support or create new one
    let support = await SupportPage.findOne({});

    if (!support) {
      support = new SupportPage({
        title: title || 'Support & FAQ',
        description: description || 'Welcome to support.',
        email,
        phone,
        footerText: footerText || 'Our Support Team is available 24/7 to assist you.',
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) support.title = title;
      if (description !== undefined) support.description = description;
      if (email !== undefined) support.email = email;
      if (phone !== undefined) support.phone = phone;
      if (footerText !== undefined) support.footerText = footerText;
      if (isActive !== undefined) support.isActive = isActive;
      support.updatedBy = req.admin._id;
    }

    await support.save();

    return successResponse(res, 200, 'Support data updated successfully', support);
  } catch (error) {
    console.error('Error updating support data:', error);
    return errorResponse(res, 500, 'Failed to update support data');
  }
});
