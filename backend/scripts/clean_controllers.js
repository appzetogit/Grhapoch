import fs from 'fs';

const filePath = 'backend/controllers/deliveryOrdersController.js';
let content = fs.readFileSync(filePath, 'utf8');

// A function to generate a clean query for finding an order
const getOrderFinderCode = (extraPopulate = '') => `
    // Find order by _id or orderId field
    let order = null;
    const isObjectId = mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24;
    const idFilter = isObjectId ? { $or: [{ _id: orderId }, { orderId: orderId }] } : { orderId: orderId };
    
    order = await Order.findOne({
      $and: [
        idFilter,
        {
          $or: [
            { deliveryPartnerId: deliveryId },
            { deliveryPartnerId: deliveryId.toString() }
          ]
        }
      ]
    })${extraPopulate};
`;

// 1. Fix confirmReachedPickup (starts around line 1305)
// I'll use a more manual approach to be safe since it's already corrupted
content = content.replace(
  /\/\/ Find order by _id or orderId field[\s\S]*?if \(!order\) {/,
  getOrderFinderCode() + "\n    if (!order) {"
);

// 2. Fix confirmOrderId (starts around line 1475)
content = content.replace(
  /\/\/ Find order by _id or orderId - try multiple methods for better compatibility[\s\S]*?if \(!order\) {/,
  getOrderFinderCode(".populate('userId', 'name phone').populate('restaurantId', 'name location address phone ownerPhone').lean()") + "\n    if (!order) {"
);

// 3. Fix confirmReachedDrop (starts around line 1889)
content = content.replace(
  /\/\/ Find order by _id or orderId, and ensure it's assigned to this delivery partner[\s\S]*?if \(!order\) {/,
  getOrderFinderCode() + "\n    if (!order) {"
);

// 4. Fix completeDelivery (starts around line 2099)
content = content.replace(
  /\/\/ Find order - try both by _id and orderId, and ensure it's assigned to this delivery partner[\s\S]*?if \(!order\) {/,
  getOrderFinderCode(".populate('restaurantId', 'name location address phone ownerPhone').populate('userId', 'name phone').lean()") + "\n    if (!order) {"
);

fs.writeFileSync(filePath, content);
console.log('Controllers cleaned and fixed');
