import Restaurant from '../models/Restaurant.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { createRestaurantFromOnboarding } from './restaurantController.js';

// Validation constants
const NAME_REGEX = /^[A-Za-z\s]+$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const validateName = (name) => {
  if (!name) return false;
  const v = name.trim();
  return v.length >= 3 && v.length <= 50 && NAME_REGEX.test(v);
};

// Get current restaurant's onboarding data
export const getOnboarding = async (req, res) => {
  try {
    // Check if restaurant is authenticated
    if (!req.restaurant || !req.restaurant._id) {
      return errorResponse(res, 401, 'Restaurant not authenticated');
    }

    const restaurantId = req.restaurant._id;
    const restaurant = await Restaurant.findById(restaurantId).select('onboarding businessModel subscription onboardingCompleted').lean();

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const selectedModel =
      restaurant?.onboarding?.step5?.businessModel ||
      restaurant?.businessModel ||
      'Commission Base';

    return successResponse(res, 200, 'Onboarding data retrieved', {
      onboarding: {
        ...(restaurant.onboarding || {}),
        businessModel: selectedModel
      },
      subscription: restaurant.subscription || null,
      onboardingCompleted: restaurant.onboardingCompleted === true
    });
  } catch (error) {
    console.error('Error fetching restaurant onboarding:', error);
    return errorResponse(res, 500, 'Failed to fetch onboarding data');
  }
};

// Upsert onboarding data (all steps in one payload)
export const upsertOnboarding = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { step1, step2, step3, step4, step5, completedSteps, businessModel } = req.body;

    // Get existing restaurant data to merge if needed
    const existingRestaurant = await Restaurant.findById(restaurantId).lean();
    const existingOnboarding = existingRestaurant?.onboarding || {};

    const update = {};

    // Step1: Always update if provided
    if (step1) {
      if (step1.ownerName && !validateName(step1.ownerName)) {
        return errorResponse(res, 400, 'Name must contain only letters (3???50 characters).');
      }
      update['onboarding.step1'] = step1;
    }

    // Step2: Update if provided
    if (step2 !== undefined && step2 !== null) {
      update['onboarding.step2'] = step2;
    }

    // Step3: Update if provided
    if (step3 !== undefined && step3 !== null) {
      // Support both legacy flat fields and current nested structure
      const panNumber = step3.pan?.panNumber || step3.panNumber;
      const nameOnPan = step3.pan?.nameOnPan || step3.nameOnPan;
      const gstRegistered =
        step3.gst?.isRegistered !== undefined ? step3.gst?.isRegistered : step3.gstRegistered;
      const gstNumber = step3.gst?.gstNumber || step3.gstNumber;
      const gstLegalName = step3.gst?.legalName || step3.gstLegalName;
      const fssaiNumber = step3.fssai?.registrationNumber || step3.fssaiNumber;
      const fssaiExpiry = step3.fssai?.expiryDate || step3.fssaiExpiry;
      const accountNumber = step3.bank?.accountNumber || step3.accountNumber;
      const confirmAccountNumber = step3.confirmAccountNumber;
      const ifscCode = step3.bank?.ifscCode || step3.ifscCode;
      const accountHolderName = step3.bank?.accountHolderName || step3.accountHolderName;
      const accountType = step3.bank?.accountType || step3.accountType;
      const panImage = step3.pan?.image || step3.panImage;
      const fssaiImage = step3.fssai?.image || step3.fssaiImage;
      const gstImage = step3.gst?.image || step3.gstImage;

      // Required fields (align with frontend validations)
      if (!panNumber) {
        return errorResponse(res, 400, 'PAN number is required');
      }
      if (!nameOnPan) {
        return errorResponse(res, 400, 'Name on PAN is required');
      }
      if (!panImage) {
        return errorResponse(res, 400, 'PAN image is required');
      }
      if (!fssaiNumber) {
        return errorResponse(res, 400, 'FSSAI number is required');
      }
      if (!fssaiExpiry) {
        return errorResponse(res, 400, 'FSSAI expiry is required');
      }
      if (!fssaiImage) {
        return errorResponse(res, 400, 'FSSAI image is required');
      }
      if (!accountNumber) {
        return errorResponse(res, 400, 'Account number is required');
      }
      if (!ifscCode) {
        return errorResponse(res, 400, 'IFSC code is required');
      }
      if (!accountHolderName) {
        return errorResponse(res, 400, 'Account holder name is required');
      }
      if (!accountType) {
        return errorResponse(res, 400, 'Account type is required');
      }

      if (gstRegistered) {
        if (!gstNumber) {
          return errorResponse(res, 400, 'GST number is required');
        }
        if (!gstLegalName) {
          return errorResponse(res, 400, 'GST legal name is required');
        }
        if (!step3.gst?.address && !step3.gstAddress) {
          return errorResponse(res, 400, 'GST address is required');
        }
        if (!gstImage) {
          return errorResponse(res, 400, 'GST image is required');
        }
      }

      // PAN Validation
      if (panNumber && !PAN_REGEX.test(panNumber)) {
        if (panNumber.length < 10) {
          return errorResponse(res, 400, 'PAN number must be exactly 10 characters (Format: AAAAA9999A)');
        }
        return errorResponse(res, 400, 'Invalid PAN format. Example: ABCDE1234F');
      }
      if (nameOnPan && !validateName(nameOnPan)) {
        return errorResponse(res, 400, 'Name must contain only letters (3???50 characters).');
      }

      // GST Validation
      if (gstRegistered) {
        if (gstNumber && !GST_REGEX.test(gstNumber)) {
          return errorResponse(res, 400, 'Invalid GST number. Example: 22ABCDE1234F1Z5');
        }
        if (gstLegalName && !validateName(gstLegalName)) {
          return errorResponse(res, 400, 'Legal name must contain only letters.');
        }
      }

      // FSSAI Validation
      if (fssaiNumber && (fssaiNumber.length !== 14 || !/^\d+$/.test(fssaiNumber))) {
        return errorResponse(res, 400, 'Invalid FSSAI number. It must contain exactly 14 digits.');
      }

      // Bank Account Validation
      if (accountNumber) {
        if (accountNumber.length < 9 || accountNumber.length > 18 || !/^\d+$/.test(accountNumber)) {
          return errorResponse(res, 400, 'Invalid account number. Only numbers are allowed.');
        }
      }
      if (confirmAccountNumber && confirmAccountNumber !== accountNumber) {
        return errorResponse(res, 400, 'Account numbers do not match. Please re-enter correctly.');
      }
      if (ifscCode && !IFSC_REGEX.test(ifscCode)) {
        return errorResponse(res, 400, 'Invalid IFSC code. Example: SBIN0001234');
      }
      if (accountHolderName && !validateName(accountHolderName)) {
        return errorResponse(res, 400, 'Name must contain only letters (3???50 characters).');
      }

      // Normalize account type to match enum: 'Saving' or 'Current'
      if (accountType) {
        const at = String(accountType).toLowerCase();
        const normalized = at === 'saving' || at === 'savings' ? 'Saving' : at === 'current' ? 'Current' : null;
        if (normalized) {
          if (!step3.bank) step3.bank = {};
          step3.bank.accountType = normalized;
        }
      }

      update['onboarding.step3'] = step3;
    }

    // Step4: Always update if provided
    if (step4 !== undefined && step4 !== null) {
      update['onboarding.step4'] = step4;
    }

    // Step5: Update if provided
    if (step5 !== undefined && step5 !== null) {
      update['onboarding.step5'] = step5;
    }

    // Update completedSteps if provided
    if (typeof completedSteps === 'number' && completedSteps !== null && completedSteps !== undefined) {
      update['onboarding.completedSteps'] = completedSteps;
    }










    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      { $set: update },
      {
        new: true,
        upsert: false
      }
    );

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const onboarding = restaurant.onboarding;
    const finalCompletedSteps = onboarding.completedSteps || completedSteps;



    // Sync fields to main restaurant document ONLY when onboarding is complete (step 5)
    if (finalCompletedSteps === 5) {
      try {
        const syncData = {
          step1: step1 || onboarding.step1,
          step2: step2 || onboarding.step2,
          step4: step4 || onboarding.step4
        };
        await createRestaurantFromOnboarding(syncData, restaurantId);
      } catch (syncError) {
        console.error('⚠️ Error syncing onboarding data to restaurant schema:', syncError);
        // We continue anyway so onboarding state is at least saved
      }
    }

    // Update restaurant schema when completing onboarding (step 5)
    if (finalCompletedSteps >= 5 && (step5 || businessModel)) {

      const requestedModel = step5?.businessModel || businessModel || onboarding.businessModel;

      // Treat any already-active subscription as the source of truth
      const hasActiveSubscription = (() => {
        const sub = restaurant?.subscription || existingRestaurant?.subscription;
        if (!sub) return false;
        if (sub.status !== 'active') return false;
        if (!sub.endDate) return true;
        return new Date(sub.endDate) > new Date();
      })();

      // Never downgrade if a subscription is active.
      // If user picked Subscription Base, keep it so payment flow can proceed.
      // Keep Subscription Base ONLY after a paid subscription is active.
      // If user selected Subscription Base but hasn't paid yet, keep Commission Base.
      const modelToSave =
        hasActiveSubscription ? 'Subscription Base'
          : requestedModel === 'Subscription Base' ? 'Commission Base'
            : 'Commission Base';




      try {
        const updateData = {};
        updateData.businessModel = modelToSave;

        if (Object.keys(updateData).length > 0) {
          const updated = await Restaurant.findByIdAndUpdate(restaurantId, { $set: updateData }, { new: true });



        }
      } catch (bmUpdateError) {
        console.error('⚠️ Error updating restaurant schema with final data:', bmUpdateError);
      }
    }









    // Update restaurant with final data if onboarding is complete (step 5)
    if (finalCompletedSteps === 5 || step5 && completedSteps === 5) {


      // Fetch the complete restaurant to verify all data is saved
      const completeRestaurant = await Restaurant.findById(restaurantId).lean();






      // Return success response with restaurant info
      // If a paid subscription is active, keep restaurant auto-approved.
      // Otherwise, keep the legacy pending-admin-approval flow.
      const finalBusinessModel =
        (step5 && step5.businessModel) ||
        onboarding?.step5?.businessModel ||
        'Commission Base';

      const now = new Date();
      const currentSubscription = completeRestaurant?.subscription || null;
      const subscriptionEnd = currentSubscription?.endDate ? new Date(currentSubscription.endDate) : null;
      const hasPaidSubscription = Boolean(
        currentSubscription &&
        currentSubscription.planId &&
        ['active', 'pending_approval', 'cancelled'].includes(currentSubscription.status) &&
        (!subscriptionEnd || subscriptionEnd > now)
      );

      const updateData = {
        onboardingCompleted: true,
        'onboarding.completedSteps': 5
      };

      if (hasPaidSubscription) {
        updateData['onboarding.status'] = 'approved';
        updateData.businessModel = 'Subscription Base';
        updateData['onboarding.step5.businessModel'] = 'Subscription Base';
        updateData.isActive = true;
        if (currentSubscription?.status === 'pending_approval') {
          updateData['subscription.status'] = 'active';
        }
      } else {
        updateData['onboarding.status'] = 'pending_admin_approval';
        // If subscription was selected but not yet paid, keep Commission Base for now.
        updateData.businessModel = finalBusinessModel === 'Subscription Base' ? 'Commission Base' : finalBusinessModel;
        updateData.isActive = false;
      }

      await Restaurant.findByIdAndUpdate(restaurantId, { $set: updateData });

      return successResponse(res, 200, 'Onboarding data saved and restaurant updated', {
        onboarding,
        restaurant: {
          restaurantId: completeRestaurant?.restaurantId,
          _id: completeRestaurant?._id,
          name: completeRestaurant?.name,
          slug: completeRestaurant?.slug,
          isActive: completeRestaurant?.isActive,
          businessModel: completeRestaurant?.businessModel
        }
      });
    }

    return successResponse(res, 200, 'Onboarding data saved', {
      onboarding
    });
  } catch (error) {
    console.error('Error saving restaurant onboarding:', error);
    return errorResponse(res, 500, 'Failed to save onboarding data');
  }
};

// Manual trigger to update restaurant from onboarding (for debugging/fixing)
export const createRestaurantFromOnboardingManual = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;

    // Fetch the complete restaurant with onboarding data
    const restaurant = await Restaurant.findById(restaurantId).lean();

    if (!restaurant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    if (!restaurant.onboarding) {
      return errorResponse(res, 404, 'Onboarding data not found');
    }

    if (!restaurant.onboarding.step1 || !restaurant.onboarding.step2) {
      return errorResponse(res, 400, 'Incomplete onboarding data. Please complete all steps first.');
    }

    if (restaurant.onboarding.completedSteps !== 3) {
      return errorResponse(res, 400, `Onboarding not complete. Current step: ${restaurant.onboarding.completedSteps}/3`);
    }

    try {
      const updatedRestaurant = await createRestaurantFromOnboarding(restaurant.onboarding, restaurantId);

      return successResponse(res, 200, 'Restaurant updated successfully', {
        restaurant: {
          restaurantId: updatedRestaurant.restaurantId,
          _id: updatedRestaurant._id,
          name: updatedRestaurant.name,
          slug: updatedRestaurant.slug,
          isActive: updatedRestaurant.isActive
        }
      });
    } catch (error) {
      console.error('Error updating restaurant:', error);
      return errorResponse(res, 500, `Failed to update restaurant: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in createRestaurantFromOnboardingManual:', error);
    return errorResponse(res, 500, 'Failed to process request');
  }
};
