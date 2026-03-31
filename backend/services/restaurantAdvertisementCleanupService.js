import Advertisement from '../models/Advertisement.js';
import { deleteFromCloudinary } from '../utils/cloudinaryService.js';

const getUniquePublicIds = (advertisement = {}) => {
  const ids = [
    advertisement?.fileMedia?.publicId,
    advertisement?.videoMedia?.publicId,
    advertisement?.bannerPublicId
  ].
    map((id) => String(id || '').trim()).
    filter(Boolean);

  return [...new Set(ids)];
};

const safeDeleteCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.warn(`[Restaurant Ad Cleanup] Failed to delete Cloudinary asset ${publicId}:`, error.message);
  }
};

export const cleanupRestaurantAdvertisements = async (restaurantId) => {
  if (!restaurantId) {
    return { deletedCount: 0, cloudinaryAssetsAttempted: 0 };
  }

  const advertisements = await Advertisement.find({ restaurant: restaurantId }).select('_id fileMedia videoMedia bannerPublicId').lean();
  if (!advertisements.length) {
    return { deletedCount: 0, cloudinaryAssetsAttempted: 0 };
  }

  let cloudinaryAssetsAttempted = 0;
  for (const ad of advertisements) {
    const publicIds = getUniquePublicIds(ad);
    cloudinaryAssetsAttempted += publicIds.length;
    for (const publicId of publicIds) {
      await safeDeleteCloudinary(publicId);
    }
  }

  const adIds = advertisements.map((ad) => ad._id);
  const deleteResult = await Advertisement.deleteMany({ _id: { $in: adIds } });

  return {
    deletedCount: deleteResult?.deletedCount || 0,
    cloudinaryAssetsAttempted
  };
};

