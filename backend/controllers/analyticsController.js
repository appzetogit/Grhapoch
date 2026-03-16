import Order from '../models/Order.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Get trending searches based on most frequently ordered items in the last 30 days
 */
export const getTrendingSearches = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate to find most ordered item names
    const trendingItems = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          count: { $sum: '$items.quantity' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Fallback static list in case no orders yet or too few items
    const fallbackSearches = [
      'Burger',
      'Biryani',
      'Pizza',
      'Pasta',
      'Thali',
      'Dosa',
      'Momos',
      'Desserts',
      'Chinese',
      'Wraps'
    ];

    let result = trendingItems.map(item => item._id);

    // Ensure we have a decent number of suggestions, mix with fallbacks if needed
    if (result.length < 5) {
      const uniqueFallbacks = fallbackSearches.filter(f => !result.includes(f));
      result = [...result, ...uniqueFallbacks.slice(0, 10 - result.length)];
    }

    return successResponse(res, 200, 'Trending searches retrieved successfully', {
      trending: result
    });
  } catch (error) {
    console.error('Error fetching trending searches:', error);
    return errorResponse(res, 500, 'Failed to fetch trending searches');
  }
};
