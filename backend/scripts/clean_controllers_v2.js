import fs from 'fs';

const filePath = 'backend/controllers/deliveryOrdersController.js';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Function to replace a range of lines with a clean query block
function replaceQueryRange(startKeyword, endKeyword, extraPopulate = '') {
  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(startKeyword) && startIndex === -1) {
      startIndex = i;
    }
    if (startIndex !== -1 && lines[i].includes(endKeyword)) {
      endIndex = i;
      break;
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    const cleanBlock = [
      `    // Find order by _id or orderId field`,
      `    let order = null;`,
      `    const isObjectId = mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24;`,
      `    const idFilter = isObjectId ? { $or: [{ _id: orderId }, { orderId: orderId }] } : { orderId: orderId };`,
      `    `,
      `    order = await Order.findOne({`,
      `      $and: [`,
      `        idFilter,`,
      `        {`,
      `          $or: [`,
      `            { deliveryPartnerId: deliveryId },`,
      `            { deliveryPartnerId: deliveryId.toString() }`,
      `          ]`,
      `        }`,
      `      ]`,
      `    })${extraPopulate};`
    ];
    lines.splice(startIndex, endIndex - startIndex + 1, ...cleanBlock);
    return true;
  }
  return false;
}

// 1. confirmReachedPickup
replaceQueryRange('// Find order by _id', 'if (!order) {');

// 2. confirmOrderId
// Note: We need to find the SECOND instance of "// Find order by _id" or use a unique keyword
replaceQueryRange('// Find order by _id or orderId - try multiple methods', 'if (!order) {', ".populate('userId', 'name phone').populate('restaurantId', 'name location address phone ownerPhone').lean()");

// 3. confirmReachedDrop
replaceQueryRange('// Find order by _id or orderId, and ensure it\'s assigned', 'if (!order) {');

// 4. completeDelivery
replaceQueryRange('// Find order - try both by _id and orderId', 'if (!order) {', ".populate('restaurantId', 'name location address phone ownerPhone').populate('userId', 'name phone').lean()");

fs.writeFileSync(filePath, lines.join('\n'));
console.log('File successfully cleaned with line-based replacement');
