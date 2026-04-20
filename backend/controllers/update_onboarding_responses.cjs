const fs = require('fs');
const path = 'c:\\Grhapoch\\backend\\controllers\\restaurantAuthController.js';
let content = fs.readFileSync(path, 'utf8');

// The logic is to add onboardingCompleted: restaurant.onboardingCompleted after onboarding field in responses
// We'll use regex to match the pattern and add the line

// Match login response
content = content.replace(
    /(login = asyncHandler\(async \(req, res\) => \{[\s\S]*?restaurant: \{[\s\S]*?onboarding: restaurant\.onboarding,)/,
    '$1\n      onboardingCompleted: restaurant.onboardingCompleted,'
);

// Match getCurrentRestaurant response
content = content.replace(
    /(getCurrentRestaurant = asyncHandler\(async \(req, res\) => \{[\s\S]*?onboarding: restaurant\.onboarding,)/,
    '$1\n      onboardingCompleted: restaurant.onboardingCompleted,'
);

// Match firebaseGoogleLogin response
content = content.replace(
    /(firebaseGoogleLogin = asyncHandler\(async \(req, res\) => \{[\s\S]*?restaurant: \{[\s\S]*?onboarding: restaurant\.onboarding,)/,
    '$1\n        onboardingCompleted: restaurant.onboardingCompleted,'
);

fs.writeFileSync(path, content);
console.log('Successfully updated restaurantProfile responses');
