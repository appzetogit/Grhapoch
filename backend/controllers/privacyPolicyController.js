import PrivacyPolicy from '../models/PrivacyPolicy.js';
import { successResponse, errorResponse } from '../utils/response.js';
import asyncHandler from '../middleware/asyncHandler.js';

/**
 * Get Privacy Policy (Public)
 * GET /api/privacy/public/:role
 */
export const getPrivacyPublic = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const privacy = await PrivacyPolicy.findOne({ role: role || 'user', isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!privacy) {
      // Return default data if no privacy policy exists
      return successResponse(res, 200, 'Privacy policy retrieved successfully', {
        title: 'Privacy Policy',
        content: '<p>No privacy policy available at the moment.</p>',
        role: role || 'user'
      });
    }

    return successResponse(res, 200, 'Privacy policy retrieved successfully', privacy);
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    return errorResponse(res, 500, 'Failed to fetch privacy policy');
  }
});

/**
 * Get Privacy Policy (Admin)
 * GET /api/admin/privacy/:role
 */
export const getPrivacy = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    let privacy = await PrivacyPolicy.findOne({ role: role || 'user', isActive: true }).lean();

    if (!privacy) {
      // Create default privacy policy if it doesn't exist
      privacy = await PrivacyPolicy.create({
        title: 'Privacy Policy',
        content: `<p>Privacy Policy for ${role || 'user'}</p>`,
        role: role || 'user',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Privacy policy retrieved successfully', privacy);
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
    return errorResponse(res, 500, 'Failed to fetch privacy policy');
  }
});

/**
 * Update Privacy Policy
 * PUT /api/admin/privacy/:role
 */
export const updatePrivacy = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const { title, content } = req.body;

    // Validate required fields
    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    // Find existing privacy policy or create new one
    let privacy = await PrivacyPolicy.findOne({ role: role || 'user', isActive: true });

    if (!privacy) {
      privacy = new PrivacyPolicy({
        title: title || 'Privacy Policy',
        content,
        role: role || 'user',
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) privacy.title = title;
      privacy.content = content;
      privacy.updatedBy = req.admin._id;
    }

    await privacy.save();

    return successResponse(res, 200, 'Privacy policy updated successfully', privacy);
  } catch (error) {
    console.error('Error updating privacy policy:', error);
    return errorResponse(res, 500, 'Failed to update privacy policy');
  }
});
