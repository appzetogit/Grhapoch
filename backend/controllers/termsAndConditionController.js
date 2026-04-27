import TermsAndCondition from '../models/TermsAndCondition.js';
import { successResponse, errorResponse } from '../utils/response.js';
import asyncHandler from '../middleware/asyncHandler.js';

/**
 * Get Terms and Condition (Public)
 * GET /api/terms/public/:role
 */
export const getTermsPublic = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const terms = await TermsAndCondition.findOne({ role: role || 'user', isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!terms) {
      // Return default data if no terms exists
      return successResponse(res, 200, 'Terms and conditions retrieved successfully', {
        title: 'Terms and Conditions',
        content: '<p>No terms and conditions available at the moment.</p>',
        role: role || 'user'
      });
    }

    return successResponse(res, 200, 'Terms and conditions retrieved successfully', terms);
  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch terms and conditions');
  }
});

/**
 * Get Terms and Condition (Admin)
 * GET /api/admin/terms/:role
 */
export const getTerms = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    let terms = await TermsAndCondition.findOne({ role: role || 'user', isActive: true }).lean();

    if (!terms) {
      // Create default terms if it doesn't exist
      terms = await TermsAndCondition.create({
        title: 'Terms and Conditions',
        content: `<p>Terms & Conditions for ${role || 'user'}</p>`,
        role: role || 'user',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Terms and conditions retrieved successfully', terms);
  } catch (error) {
    console.error('Error fetching terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to fetch terms and conditions');
  }
});

/**
 * Update Terms and Condition
 * PUT /api/admin/terms/:role
 */
export const updateTerms = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const { title, content } = req.body;

    // Validate required fields
    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    // Find existing terms or create new one
    let terms = await TermsAndCondition.findOne({ role: role || 'user', isActive: true });

    if (!terms) {
      terms = new TermsAndCondition({
        title: title || 'Terms and Conditions',
        content,
        role: role || 'user',
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) terms.title = title;
      terms.content = content;
      terms.updatedBy = req.admin._id;
    }

    await terms.save();

    return successResponse(res, 200, 'Terms and conditions updated successfully', terms);
  } catch (error) {
    console.error('Error updating terms and conditions:', error);
    return errorResponse(res, 500, 'Failed to update terms and conditions');
  }
});
