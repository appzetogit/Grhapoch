import UserAdvertisement from '../models/UserAdvertisement.js';
import { deleteFromCloudinary } from '../utils/cloudinaryService.js';

const safeDeleteCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.warn(`[User Ad Cleanup] Failed to delete Cloudinary asset ${publicId}:`, error.message);
  }
};

export const deactivateUserAdvertisements = async ({ userId, adminId = null } = {}) => {
  if (!userId) {
    return { deactivatedCount: 0, markedExpiredCount: 0 };
  }

  const now = new Date();
  const deactivateResult = await UserAdvertisement.updateMany(
    {
      userId,
      isDeleted: false,
      isActive: true
    },
    {
      $set: {
        isActive: false,
        reviewedAt: now,
        reviewedBy: adminId || null
      }
    }
  );

  const expireResult = await UserAdvertisement.updateMany(
    {
      userId,
      isDeleted: false,
      status: 'active'
    },
    {
      $set: {
        status: 'expired',
        reviewedAt: now,
        reviewedBy: adminId || null
      }
    }
  );

  return {
    deactivatedCount: deactivateResult?.modifiedCount || 0,
    markedExpiredCount: expireResult?.modifiedCount || 0
  };
};

export const deleteUserAdvertisements = async (userId) => {
  if (!userId) {
    return { deletedCount: 0, cloudinaryAssetsAttempted: 0 };
  }

  const advertisements = await UserAdvertisement.find({ userId }).select('_id bannerPublicId').lean();
  if (!advertisements.length) {
    return { deletedCount: 0, cloudinaryAssetsAttempted: 0 };
  }

  let cloudinaryAssetsAttempted = 0;
  for (const ad of advertisements) {
    const publicId = String(ad?.bannerPublicId || '').trim();
    if (publicId) {
      cloudinaryAssetsAttempted += 1;
      await safeDeleteCloudinary(publicId);
    }
  }

  const adIds = advertisements.map((ad) => ad._id);
  const deleteResult = await UserAdvertisement.deleteMany({ _id: { $in: adIds } });

  return {
    deletedCount: deleteResult?.deletedCount || 0,
    cloudinaryAssetsAttempted
  };
};
