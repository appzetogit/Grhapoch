
const fs = require('fs');
const path = require('path');

const filepath = 'c:\\Grhapoch\\frontend\\src\\module\\user\\pages\\DiningRestaurantDetail.jsx';
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split('\n');

let firstOccurrence = -1;
let secondOccurrence = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('{/* Bottom Action for steps 1-5 */}')) {
        if (firstOccurrence === -1) {
            firstOccurrence = i;
        } else {
            secondOccurrence = i;
            break;
        }
    }
}

if (firstOccurrence !== -1 && secondOccurrence !== -1) {
    console.log(`Found occurrences at lines ${firstOccurrence + 1} and ${secondOccurrence + 1}`);
    
    // We want to remove the block between them INDLUDING the extra tags before the first one.
    // Based on previous view:
    // 1032:             }
    // 1033:                     </div>
    // 1034: 
    // 1035:                     {/* Bottom Action for steps 1-5 */}
    
    // firstOccurrence is 1034 (0-indexed).
    // We want to remove 1032 and 1033 too.
    
    const newLines = [
        ...lines.slice(0, firstOccurrence - 2),
        ...lines.slice(secondOccurrence)
    ];
    
    fs.writeFileSync(filepath, newLines.join('\n'), 'utf8');
    console.log('File cleaned successfully.');
} else {
    console.log('Could not find both occurrences.');
}
