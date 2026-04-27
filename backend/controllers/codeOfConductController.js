import CodeOfConduct from '../models/CodeOfConduct.js';
import { successResponse, errorResponse } from '../utils/response.js';
import asyncHandler from '../middleware/asyncHandler.js';

/**
 * Get Code of Conduct (Public)
 * GET /api/code-of-conduct/public/:role
 */
export const getCodeOfConductPublic = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const conduct = await CodeOfConduct.findOne({ role: role || 'restaurant', isActive: true })
      .select('-updatedBy -createdAt -updatedAt -__v')
      .lean();

    if (!conduct) {
      // Return default data if no code of conduct exists
      return successResponse(res, 200, 'Code of conduct retrieved successfully', {
        title: 'Code of Conduct',
        content: '<p>No code of conduct available at the moment.</p>',
        role: role || 'restaurant'
      });
    }

    return successResponse(res, 200, 'Code of conduct retrieved successfully', conduct);
  } catch (error) {
    console.error('Error fetching code of conduct:', error);
    return errorResponse(res, 500, 'Failed to fetch code of conduct');
  }
});

/**
 * Get Code of Conduct (Admin)
 * GET /api/admin/code-of-conduct/:role
 */
export const getCodeOfConduct = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    let conduct = await CodeOfConduct.findOne({ role: role || 'restaurant', isActive: true }).lean();

    if (!conduct) {
      // Create default conduct if it doesn't exist
      conduct = await CodeOfConduct.create({
        title: 'Code of Conduct',
        content: `<p>Code of Conduct for ${role || 'restaurant'}</p>`,
        role: role || 'restaurant',
        updatedBy: req.admin._id
      });
    }

    return successResponse(res, 200, 'Code of conduct retrieved successfully', conduct);
  } catch (error) {
    console.error('Error fetching code of conduct:', error);
    return errorResponse(res, 500, 'Failed to fetch code of conduct');
  }
});

/**
 * Update Code of Conduct
 * PUT /api/admin/code-of-conduct/:role
 */
export const updateCodeOfConduct = asyncHandler(async (req, res) => {
  try {
    const { role } = req.params;
    const { title, content } = req.body;

    // Validate required fields
    if (!content) {
      return errorResponse(res, 400, 'Content is required');
    }

    // Find existing conduct or create new one
    let conduct = await CodeOfConduct.findOne({ role: role || 'restaurant', isActive: true });

    if (!conduct) {
      conduct = new CodeOfConduct({
        title: title || 'Code of Conduct',
        content,
        role: role || 'restaurant',
        updatedBy: req.admin._id
      });
    } else {
      if (title !== undefined) conduct.title = title;
      conduct.content = content;
      conduct.updatedBy = req.admin._id;
    }

    await conduct.save();

    return successResponse(res, 200, 'Code of conduct updated successfully', conduct);
  } catch (error) {
    console.error('Error updating code of conduct:', error);
    return errorResponse(res, 500, 'Failed to update code of conduct');
  }
});
