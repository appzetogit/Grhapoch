import fs from 'fs';

const filePath = 'backend/controllers/deliveryOrdersController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace generic deliveryPartnerId matches with a robust $in query
content = content.replace(/deliveryPartnerId:\s*deliveryId(\.toString\(\))?/g, 
  "deliveryPartnerId: { $in: [deliveryId, deliveryId.toString()] }");

fs.writeFileSync(filePath, content);
console.log('Queries updated successfully with $in');
