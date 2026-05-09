import Order from '../models/Order.js';
import RestaurantCommission from '../models/RestaurantCommission.js';
import WithdrawalRequest from '../models/WithdrawalRequest.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import { successResponse, errorResponse } from '../utils/response.js';
import asyncHandler from '../middleware/asyncHandler.js';
import mongoose from 'mongoose';

/**
 * Get restaurant finance/payout data
 * GET /api/restaurant/finance
 * Query params: startDate, endDate (for past cycles)
 */
export const getRestaurantFinance = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { startDate, endDate } = req.query;

    // Get restaurant ID
    const restaurantId = restaurant._id?.toString() || restaurant.restaurantId || restaurant.id;

    if (!restaurantId) {
      return errorResponse(res, 500, 'Restaurant ID not found');
    }

    // Calculate current cycle dates (default: Monday to Sunday of current week)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert Sunday (0) to 6

    // Start of current cycle (Monday)
    const currentCycleStart = new Date(now);
    currentCycleStart.setDate(now.getDate() - daysFromMonday);
    currentCycleStart.setHours(0, 0, 0, 0);

    // End of current cycle (Sunday)
    const currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setDate(currentCycleStart.getDate() + 6);
    currentCycleEnd.setHours(23, 59, 59, 999);

    // Query for restaurant orders - handle multiple restaurantId formats (ObjectId and custom restaurantId)
    const restaurantIdVariations = [];
    
    // 1. Add MongoDB ObjectId variations
    if (restaurant._id) {
      const objectIdStr = restaurant._id.toString();
      restaurantIdVariations.push(objectIdStr);
      try {
        if (mongoose.Types.ObjectId.isValid(restaurant._id)) {
          restaurantIdVariations.push(new mongoose.Types.ObjectId(restaurant._id));
        }
      } catch (e) {}
    }

    // 2. Add custom restaurantId (e.g., REST000400)
    if (restaurant.restaurantId && !restaurantIdVariations.includes(restaurant.restaurantId)) {
      restaurantIdVariations.push(restaurant.restaurantId);
    }

    // 3. Add legacy id if present
    if (restaurant.id && !restaurantIdVariations.includes(restaurant.id)) {
      restaurantIdVariations.push(restaurant.id);
    }

    const restaurantIdQuery = {
      restaurantId: { $in: restaurantIdVariations }
    };

    // Get commission setup for restaurant
    let restaurantCommission = null;
    try {
      restaurantCommission = await RestaurantCommission.findOne({
        restaurant: restaurantId,
        status: true
      }).lean();
    } catch (commissionError) {
      console.warn('⚠️ Could not fetch commission setup:', commissionError.message);
    }

    const hasActiveSubscription =
    restaurant.businessModel === 'Subscription Base' &&
    restaurant.subscription?.status === 'active' && (

    !restaurant.subscription?.endDate ||
    new Date(restaurant.subscription.endDate) > new Date());



    // Helper function to calculate commission for an order
    const calculateCommissionForOrder = (order, orderAmount) => {
      // Check if order has a commission snapshot (New Orders)
      if (order.pricing && order.pricing.commission && order.pricing.commission.amount !== undefined) {
        return {
          commission: order.pricing.commission.amount,
          type: order.pricing.commission.type || 'percentage',
          value: order.pricing.commission.rate || 0
        };
      }

      // Fallback for old orders: Calculate based on current settings (may be inaccurate if plan changed)
      // Check business model - strict check
      if (hasActiveSubscription) {
        return {
          commission: 0,
          type: 'percentage',
          value: 0
        };
      }

      if (!restaurantCommission || !restaurantCommission.status) {
        // Default 10% if no commission setup
        return {
          commission: orderAmount * 10 / 100,
          type: 'percentage',
          value: 10
        };
      }

      // Find matching commission rule
      const sortedRules = [...(restaurantCommission.commissionRules || [])].
      filter((rule) => rule.isActive).
      sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.minOrderAmount - b.minOrderAmount;
      });

      let matchingRule = null;
      for (const rule of sortedRules) {
        if (orderAmount >= rule.minOrderAmount) {
          if (rule.maxOrderAmount === null || orderAmount <= rule.maxOrderAmount) {
            matchingRule = rule;
            break;
          }
        }
      }

      let commission = 0;
      let commissionType = 'percentage';
      let commissionValue = 10;

      if (matchingRule) {
        commissionType = matchingRule.type;
        commissionValue = matchingRule.value;
        if (matchingRule.type === 'percentage') {
          commission = orderAmount * matchingRule.value / 100;
        } else {
          commission = matchingRule.value;
        }
      } else if (restaurantCommission.defaultCommission) {
        commissionType = restaurantCommission.defaultCommission.type || 'percentage';
        commissionValue = restaurantCommission.defaultCommission.value || 10;
        if (commissionType === 'percentage') {
          commission = orderAmount * commissionValue / 100;
        } else {
          commission = commissionValue;
        }
      } else {
        // Default 10%
        commission = orderAmount * 10 / 100;
      }

      return {
        commission: Math.round(commission * 100) / 100,
        type: commissionType,
        value: commissionValue
      };
    };

    // Get current cycle orders (delivered orders in current week)
    // Query orders that were delivered in the current cycle
    // First try with deliveredAt, if not found, use tracking.delivered.timestamp as fallback
    let currentCycleOrders = await Order.find({
      status: 'delivered',
      $and: [
      restaurantIdQuery,
      {
        $or: [
        { deliveredAt: { $gte: currentCycleStart, $lte: currentCycleEnd } },
        { 'tracking.delivered.timestamp': { $gte: currentCycleStart, $lte: currentCycleEnd } }]

      }]

    }).
    populate('userId', 'name phone email').
    select('orderId userId items pricing payment status address createdAt deliveredAt tracking').
    sort({ createdAt: -1 }).
    lean();

    // If no orders found with deliveredAt/tracking, check by createdAt as last resort
    if (currentCycleOrders.length === 0) {
      currentCycleOrders = await Order.find({
        ...restaurantIdQuery,
        status: 'delivered',
        createdAt: { $gte: currentCycleStart, $lte: currentCycleEnd }
      }).
      populate('userId', 'name phone email').
      select('orderId userId items pricing payment status address createdAt deliveredAt tracking').
      sort({ createdAt: -1 }).
      lean();
    }




    // Get all unique user IDs from orders
    const userIds = [...new Set(currentCycleOrders.map((order) => {
      if (!order.userId) return null;
      // If populated, use _id, otherwise use the value directly
      if (typeof order.userId === 'object' && order.userId._id) {
        return order.userId._id.toString();
      } else if (typeof order.userId === 'object' && mongoose.Types.ObjectId.isValid(order.userId)) {
        return order.userId.toString();
      } else {
        return order.userId.toString();
      }
    }).filter(Boolean))];



    // Fetch user data in bulk
    let usersMap = {};
    if (userIds.length > 0) {
      try {
        const UserModel = (await import('../models/User.js')).default;
        // Convert string IDs to ObjectIds for query
        const objectIds = userIds.map((id) => {
          try {
            return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
          } catch (e) {
            return id;
          }
        });
        const users = await UserModel.find({ _id: { $in: objectIds } }).
        select('name phone email').
        lean();

        users.forEach((user) => {
          usersMap[user._id.toString()] = user;
        });

      } catch (error) {
        console.error('❌ Error fetching users:', error);
      }
    }

    // Calculate current cycle payout
    // IMPORTANT: Commission is calculated on FOOD PRICE (subtotal - discount), NOT on total (which includes platform fee, GST, delivery fee)
    let currentCycleTotal = 0;
    let currentCycleCommission = 0;
    const currentCycleOrdersData = await Promise.all(currentCycleOrders.map(async (order) => {
      // Food price = subtotal - restaurantDiscount (this is what commission is calculated on)
      // IMPORTANT FIX: Use only restaurant-borne discounts. Admin discounts are NOT deducted from restaurant payout.
      const restaurantDiscount = order.pricing?.restaurantDiscount !== undefined ? 
                               order.pricing.restaurantDiscount : 
                               (order.pricing?.discount || 0);
      const foodPrice = (order.pricing?.subtotal || 0) - restaurantDiscount;
      const commissionData = calculateCommissionForOrder(order, foodPrice);
      const payout = foodPrice - commissionData.commission;

      currentCycleTotal += foodPrice; // Use food price, not total
      currentCycleCommission += commissionData.commission;

      // Get food names from order items
      const foodNames = (order.items || []).map((item) => item.name).join(', ') || 'N/A';

      // Handle userId - can be ObjectId or populated object
      let customerName = 'N/A';
      let customerPhone = 'N/A';
      let customerEmail = 'N/A';

      if (order.userId) {
        let userIdStr = null;

        // Check if populated (has _id property or name property)
        if (typeof order.userId === 'object' && (order.userId.name || order.userId._id)) {
          // Populated user object
          userIdStr = order.userId._id?.toString() || order.userId.toString();
          customerName = order.userId.name || 'N/A';
          customerPhone = order.userId.phone || 'N/A';
          customerEmail = order.userId.email || 'N/A';
        } else {
          // Just ObjectId, need to look up in usersMap
          userIdStr = order.userId.toString();
          if (usersMap[userIdStr]) {
            const user = usersMap[userIdStr];
            customerName = user.name || 'N/A';
            customerPhone = user.phone || 'N/A';
            customerEmail = user.email || 'N/A';
          } else {


          }
        }
      } else {

      }

      // Format payment method - fetch full order if payment not available
      let paymentMethod = 'N/A';
      if (order.payment && order.payment.method) {
        const method = order.payment.method;
        paymentMethod = method.charAt(0).toUpperCase() + method.slice(1);
      } else {
        // Fetch full order to get payment method
        try {
          const fullOrder = await Order.findOne({ orderId: order.orderId }).
          select('payment status').
          lean();
          if (fullOrder && fullOrder.payment && fullOrder.payment.method) {
            const method = fullOrder.payment.method;
            paymentMethod = method.charAt(0).toUpperCase() + method.slice(1);
          }
        } catch (err) {

        }
      }

      // Format order status - use from order or fetch if missing
      let orderStatus = 'N/A';
      if (order.status) {
        const status = order.status;
        orderStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
      } else {
        // Fetch full order to get status
        try {
          const fullOrder = await Order.findOne({ orderId: order.orderId }).
          select('status').
          lean();
          if (fullOrder && fullOrder.status) {
            const status = fullOrder.status;
            orderStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
          }
        } catch (err) {

        }
      }

      return {
        orderId: order.orderId || order._id?.toString() || 'N/A',
        orderTotal: foodPrice, // Food price (subtotal - discount) for display
        totalAmount: order.pricing?.total || 0, // Total order amount paid by customer
        discount: order.pricing?.discount || 0,
        commission: commissionData.commission,
        payout,
        deliveredAt: order.deliveredAt || order.createdAt,
        createdAt: order.createdAt,
        items: order.items || [], // Include full items array
        foodNames: foodNames, // Include food names as comma-separated string
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        paymentMethod: paymentMethod,
        orderStatus: orderStatus,
        address: order.address || {}
      };
    }));

    // Format current cycle dates
    const formatCycleDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.getFullYear().toString().slice(-2);
      return { day: day.toString(), month, year };
    };

    const currentCycleStartFormatted = formatCycleDate(currentCycleStart);
    const currentCycleEndFormatted = formatCycleDate(currentCycleEnd);

    // Get past cycles orders if date range provided
    let pastCyclesData = null;
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Query orders that were delivered in the past cycle
      // First try with deliveredAt, if not found, use tracking.delivered.timestamp as fallback
      let pastCycleOrders = await Order.find({
        status: 'delivered',
        $and: [
        restaurantIdQuery,
        {
          $or: [
          { deliveredAt: { $gte: start, $lte: end } },
          { 'tracking.delivered.timestamp': { $gte: start, $lte: end } }]

        }]

      }).
      populate('userId', 'name phone email').
      sort({ createdAt: -1 }).
      lean();

      // If no orders found with deliveredAt/tracking, check by createdAt as last resort
      if (pastCycleOrders.length === 0) {
        pastCycleOrders = await Order.find({
          ...restaurantIdQuery,
          status: 'delivered',
          createdAt: { $gte: start, $lte: end }
        }).
        populate('userId', 'name phone email').
        select('orderId userId items pricing payment status address createdAt deliveredAt tracking').
        sort({ createdAt: -1 }).
        lean();
      }



      // Get all unique user IDs from past cycle orders
      const pastUserIds = [...new Set(pastCycleOrders.map((order) => {
        if (!order.userId) return null;
        // Handle both populated and non-populated userId
        if (typeof order.userId === 'object' && order.userId._id) {
          return order.userId._id.toString();
        } else if (typeof order.userId === 'object' && mongoose.Types.ObjectId.isValid(order.userId)) {
          return order.userId.toString();
        } else {
          return order.userId.toString();
        }
      }).filter(Boolean))];



      // Fetch user data in bulk for past cycle
      let pastUsersMap = {};
      if (pastUserIds.length > 0) {
        try {
          const UserModel = (await import('../models/User.js')).default;
          const users = await UserModel.find({ _id: { $in: pastUserIds.map((id) => new mongoose.Types.ObjectId(id)) } }).
          select('name phone email').
          lean();

          users.forEach((user) => {
            pastUsersMap[user._id.toString()] = user;
          });

        } catch (error) {
          console.error('❌ Error fetching users for past cycle:', error);
        }
      }

      let pastCycleTotal = 0;
      let pastCycleCommission = 0;
      const pastCycleOrdersData = await Promise.all(pastCycleOrders.map(async (order) => {
        // Food price = subtotal - restaurantDiscount (this is what commission is calculated on)
        // IMPORTANT FIX: Use only restaurant-borne discounts. Admin discounts are NOT deducted from restaurant payout.
        const restaurantDiscount = order.pricing?.restaurantDiscount !== undefined ? 
                                 order.pricing.restaurantDiscount : 
                                 (order.pricing?.discount || 0);
        const foodPrice = (order.pricing?.subtotal || 0) - restaurantDiscount;
        const commissionData = calculateCommissionForOrder(order, foodPrice);
        const payout = foodPrice - commissionData.commission;

        pastCycleTotal += foodPrice; // Use food price, not total
        pastCycleCommission += commissionData.commission;

        // Get food names from order items
        const foodNames = (order.items || []).map((item) => item.name).join(', ') || 'N/A';

        // Handle userId - can be ObjectId or populated object
        let customerName = 'N/A';
        let customerPhone = 'N/A';
        let customerEmail = 'N/A';

        if (order.userId) {
          let userIdStr = null;

          // Check if populated (has _id property or name property)
          if (typeof order.userId === 'object' && (order.userId.name || order.userId._id)) {
            // Populated user object
            userIdStr = order.userId._id?.toString() || order.userId.toString();
            customerName = order.userId.name || 'N/A';
            customerPhone = order.userId.phone || 'N/A';
            customerEmail = order.userId.email || 'N/A';
          } else {
            // Just ObjectId, need to look up in pastUsersMap
            userIdStr = order.userId.toString();
            if (pastUsersMap[userIdStr]) {
              const user = pastUsersMap[userIdStr];
              customerName = user.name || 'N/A';
              customerPhone = user.phone || 'N/A';
              customerEmail = user.email || 'N/A';
            } else {


            }
          }
        } else {

        }

        // Format payment method
        let paymentMethod = 'N/A';
        if (order.payment && order.payment.method) {
          const method = order.payment.method;
          paymentMethod = method.charAt(0).toUpperCase() + method.slice(1);
        } else {

        }

        // Format order status
        let orderStatus = 'N/A';
        if (order.status) {
          const status = order.status;
          orderStatus = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
        } else {

        }

        return {
          orderId: order.orderId || order._id?.toString() || 'N/A',
          orderTotal: foodPrice, // Food price (subtotal - discount) for display
          totalAmount: order.pricing?.total || 0, // Total order amount paid by customer
          discount: order.pricing?.discount || 0,
          commission: commissionData.commission,
          payout,
          deliveredAt: order.deliveredAt || order.createdAt,
          createdAt: order.createdAt,
          items: order.items || [], // Include full items array
          foodNames: foodNames, // Include food names as comma-separated string
          customerName: customerName,
          customerPhone: customerPhone,
          customerEmail: customerEmail,
          paymentMethod: paymentMethod,
          orderStatus: orderStatus,
          address: order.address || {}
        };
      }));

      pastCyclesData = {
        dateRange: {
          start: formatCycleDate(start),
          end: formatCycleDate(end)
        },
        totalOrders: pastCycleOrders.length,
        totalOrderValue: Math.round(pastCycleTotal * 100) / 100,
        totalCommission: Math.round(pastCycleCommission * 100) / 100,
        estimatedPayout: Math.round((pastCycleTotal - pastCycleCommission) * 100) / 100,
        orders: pastCycleOrdersData
      };
    }

    // Calculate current cycle payout (total - commission)
    const currentCyclePayout = Math.round((currentCycleTotal - currentCycleCommission) * 100) / 100;

    const RestaurantWallet = (await import('../models/RestaurantWallet.js')).default;
    let wallet = await RestaurantWallet.findOne({ restaurantId: restaurant._id });
    let availablePayout = wallet ? wallet.totalBalance : 0;

    // Fallback: If wallet balance is 0 or wallet missing, sync it from historical data
    // This handles older test orders or orders that bypassed the wallet update logic
    if (availablePayout === 0) {
      try {
        const allDeliveredOrders = await Order.find({ status: 'delivered', ...restaurantIdQuery }).lean();
        if (allDeliveredOrders.length > 0) {
          let totalLifetimePayout = 0;
          for (const ord of allDeliveredOrders) {
            const restaurantDiscount = ord.pricing?.restaurantDiscount !== undefined ? 
                                     ord.pricing.restaurantDiscount : 
                                     (ord.pricing?.discount || 0);
            const foodP = (ord.pricing?.subtotal || 0) - restaurantDiscount;
            const cData = calculateCommissionForOrder(ord, foodP);
            totalLifetimePayout += (foodP - cData.commission);
          }
          
          const WithdrawalRequest = (await import('../models/WithdrawalRequest.js')).default;
          const withdrawals = await WithdrawalRequest.find({ 
            restaurantId: restaurant._id, 
            status: { $in: ['approved', 'completed'] } 
          }).lean();
          
          const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
          
          availablePayout = Math.max(0, totalLifetimePayout - totalWithdrawn);
          
          // Sync wallet if there's a discrepancy
          if (availablePayout > 0) {
            if (wallet) {
              wallet.totalBalance = availablePayout;
              await wallet.save();
            } else {
              wallet = await RestaurantWallet.create({
                restaurantId: restaurant._id,
                totalBalance: availablePayout,
                transactions: [{
                  amount: availablePayout,
                  type: 'payment',
                  status: 'Completed',
                  description: 'Historical wallet sync from past delivered orders',
                  createdAt: new Date()
                }]
              });
            }
          }
        }
      } catch (syncError) {
        console.error('Error syncing historical wallet balance:', syncError);
      }
    }









    return successResponse(res, 200, 'Finance data retrieved successfully', {
      currentCycle: {
        start: currentCycleStartFormatted,
        end: currentCycleEndFormatted,
        totalOrders: currentCycleOrders.length,
        totalOrderValue: Math.round(currentCycleTotal * 100) / 100,
        totalCommission: Math.round(currentCycleCommission * 100) / 100,
        estimatedPayout: currentCyclePayout, // Net earnings for THIS period
        availablePayout: Math.max(0, Math.round(availablePayout * 100) / 100), // Actual balance available to withdraw
        payoutDate: null,
        orders: currentCycleOrdersData
      },
      pastCycles: pastCyclesData,
      restaurant: {
        name: restaurant.name || 'Restaurant',
        restaurantId: restaurant.restaurantId || restaurantId,
        address: restaurant.location?.address || restaurant.location?.formattedAddress || '',
        onboarding: {
          step3: {
            bank: restaurant.onboarding?.step3?.bank || {}
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching restaurant finance:', error);
    return errorResponse(res, 500, 'Failed to fetch finance data');
  }
});