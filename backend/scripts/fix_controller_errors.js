import fs from 'fs';

const filePath = 'backend/controllers/deliveryOrdersController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace generic error messages with detailed ones
content = content.replace(
  /return errorResponse\(res, 404, 'Order not found or not assigned to you'\);/g,
  "return errorResponse(res, 404, `Order not found or not assigned to you. (Lookup: ${orderId}, Delivery: ${deliveryId})`);"
);

fs.writeFileSync(filePath, content);
console.log('File updated successfully');
