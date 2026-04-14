$filePath = 'c:\Grhapoch\backend\controllers\restaurantController.js'
$content = Get-Content $filePath
$start = -1
$end = -1

for($i=0; $i -lt $content.Length; $i++){
    if($content[$i] -like '*export const updateRestaurantProfile*'){ $start = $i }
    if($content[$i] -like '*export const uploadProfileImage*'){ $end = $i; break }
}

if ($start -ge 0 -and $end -ge 0) {
    $fix = @(
        'export const updateRestaurantProfile = asyncHandler(async (req, res) => {',
        '  try {',
        '    const restaurantId = req.restaurant._id;',
        '    const { profileImage, menuImages, name, cuisines, location, ownerName, ownerEmail, ownerPhone, featuredDish, featuredPrice } = req.body;',
        '    const restaurant = await Restaurant.findById(restaurantId);',
        '    if (!restaurant) { return errorResponse(res, 404, "Restaurant not found"); }',
        '    const updateData = {};',
        '    if (profileImage) updateData.profileImage = profileImage;',
        '    if (menuImages !== undefined) updateData.menuImages = menuImages;',
        '    if (name) {',
        '      updateData.name = name;',
        '      if (name !== restaurant.name) {',
        '        let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");',
        '        let slug = baseSlug;',
        '        const existingBySlug = await Restaurant.findOne({ slug: baseSlug, _id: { `$ne: restaurantId } });',
        '        if (existingBySlug) {',
        '          let counter = 1; let uniqueSlug = `$baseSlug-$counter`;',
        '          while (await Restaurant.findOne({ slug: uniqueSlug, _id: { `$ne: restaurantId } })) { counter++; uniqueSlug = `$baseSlug-$counter`; }',
        '          slug = uniqueSlug;',
        '        }',
        '        updateData.slug = slug;',
        '      }',
        '    }',
        '    if (cuisines !== undefined) {',
        '      if (!Array.isArray(cuisines)) { return errorResponse(res, 400, "Cuisines must be an array of strings"); }',
        '      const cleanedCuisines = sanitizeCuisineList(cuisines, 8);',
        '      updateData.cuisines = cleanedCuisines;',
        '      if (!restaurant.onboarding) restaurant.onboarding = {};',
        '      if (!restaurant.onboarding.step2) restaurant.onboarding.step2 = {};',
        '      restaurant.onboarding.step2.cuisines = cleanedCuisines;',
        '      restaurant.markModified("onboarding");',
        '    }',
        '    if (location) {',
        '      const normalizedLocationResult = normalizeLocationForSave(location, restaurant.location);',
        '      if (normalizedLocationResult.error) { return errorResponse(res, 400, normalizedLocationResult.error); }',
        '      updateData.location = normalizedLocationResult.location;',
        '    }',
        '    if (ownerName !== undefined) updateData.ownerName = ownerName;',
        '    if (ownerEmail !== undefined) updateData.ownerEmail = ownerEmail;',
        '    if (ownerPhone !== undefined) updateData.ownerPhone = ownerPhone;',
        '    if (req.body.diningPlatformFee !== undefined) updateData.diningPlatformFee = req.body.diningPlatformFee;',
        '    if (featuredDish !== undefined) updateData.featuredDish = featuredDish;',
        '    if (featuredPrice !== undefined) updateData.featuredPrice = featuredPrice;',
        '    Object.assign(restaurant, updateData);',
        '    await restaurant.save();',
        '    return successResponse(res, 200, "Restaurant profile updated successfully", { restaurant: { id: restaurant._id, restaurantId: restaurant.restaurantId, name: restaurant.name, slug: restaurant.slug, profileImage: restaurant.profileImage, menuImages: restaurant.menuImages, cuisines: restaurant.cuisines, location: restaurant.location, ownerName: restaurant.ownerName, ownerEmail: restaurant.ownerEmail, ownerPhone: restaurant.ownerPhone, featuredDish: restaurant.featuredDish, featuredPrice: restaurant.featuredPrice } });',
        '  } catch (error) {',
        '    console.error("Error updating restaurant profile:", error);',
        '    return errorResponse(res, 500, "Failed to update restaurant profile: " + error.message);',
        '  }',
        '});',
        '',
        'export const updatePayoutDetails = asyncHandler(async (req, res) => {',
        '  try {',
        '    const restaurantId = req.restaurant._id;',
        '    const { bank, upiId, qrCode } = req.body;',
        '    const restaurant = await Restaurant.findById(restaurantId);',
        '    if (!restaurant) { return errorResponse(res, 404, "Restaurant not found"); }',
        '    if (!restaurant.onboarding) { restaurant.onboarding = { step1: {}, step2: {}, step3: {}, step4: {} }; }',
        '    if (!restaurant.onboarding.step3) { restaurant.onboarding.step3 = {}; }',
        '    if (!restaurant.onboarding.step3.bank) { restaurant.onboarding.step3.bank = {}; }',
        '    if (bank) {',
        '      if (bank.accountNumber) restaurant.onboarding.step3.bank.accountNumber = bank.accountNumber;',
        '      if (bank.ifscCode) restaurant.onboarding.step3.bank.ifscCode = bank.ifscCode;',
        '      if (bank.accountHolderName) restaurant.onboarding.step3.bank.accountHolderName = bank.accountHolderName;',
        '      if (bank.accountType) restaurant.onboarding.step3.bank.accountType = bank.accountType;',
        '    }',
        '    if (upiId !== undefined) { restaurant.onboarding.step3.bank.upiId = upiId; }',
        '    if (qrCode) { restaurant.onboarding.step3.bank.qrCode = qrCode; }',
        '    await restaurant.save();',
        '    return successResponse(res, 200, "Payout details updated successfully", { payoutDetails: restaurant.onboarding.step3.bank });',
        '  } catch (error) {',
        '    console.error("Error updating payout details:", error);',
        '    return errorResponse(res, 500, "Failed to update payout details");',
        '  }',
        '});',
        ''
    )
    $newContent = $content[0..($start-1)] + $fix + $content[$end..($content.Length-1)]
    $newContent | Set-Content $filePath -Encoding UTF8
    Write-Host "Successfully repaired restaurantController.js"
} else {
    Write-Host "Could not find function boundaries. Start: $start, End: $end"
}
