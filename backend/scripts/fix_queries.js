import fs from 'fs';

const filePath = 'backend/controllers/deliveryOrdersController.js';
let content = fs.readFileSync(filePath, 'utf8');

// Helper to replace query logic to be more robust for deliveryPartnerId
const robustPartnerQuery = `{
            $or: [
              { deliveryPartnerId: deliveryId.toString() },
              { deliveryPartnerId: mongoose.Types.ObjectId.isValid(deliveryId) ? new mongoose.Types.ObjectId(deliveryId) : deliveryId }
            ]
          }`;

// Fix confirmOrderId query
content = content.replace(
  /deliveryPartnerId: deliveryId\.toString\(\)\s*}/,
  robustPartnerQuery + "\n        }"
);

// Fix confirmReachedDrop query
content = content.replace(
  /deliveryPartnerId: deliveryId \/\/ Try as ObjectId first \(most common\)\s*}/,
  robustPartnerQuery
);

content = content.replace(
  /deliveryPartnerId: deliveryId\.toString\(\) \/\/ Try as string\s*}/,
  robustPartnerQuery
);

// Fix completeDelivery query
content = content.replace(
  /deliveryPartnerId: deliveryId\.toString\(\)\s*}/,
  robustPartnerQuery + "\n        }"
);

fs.writeFileSync(filePath, content);
console.log('Queries updated successfully');
