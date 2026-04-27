import OneTimeCoupon from '../models/OneTimeCoupon.js';

const randomCode = (len = 10) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

export const generateUniqueOneTimeCouponCode = async (prefix = 'MIS') => {
  // Try a few times to avoid collisions.
  for (let i = 0; i < 8; i += 1) {
    const code = `${prefix}-${randomCode(8)}`;
    // eslint-disable-next-line no-await-in-loop
    const exists = await OneTimeCoupon.findOne({ code }).select('_id').lean();
    if (!exists) return code;
  }
  return `${prefix}-${Date.now()}`;
};

export const createOneTimeCoupon = async ({
  userId,
  value,
  expiryDate,
  complaintId = null,
  source = 'mismatch'
}) => {
  const code = await generateUniqueOneTimeCouponCode('MIS');
  const coupon = await OneTimeCoupon.create({
    code,
    value: Math.round(Number(value) || 0),
    userId,
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    expiryDate,
    complaintId,
    source
  });
  return coupon;
};

export const reserveOneTimeCouponForCheckout = async ({
  code,
  userId,
  checkoutId,
  holdMinutes = 30
}) => {
  const now = new Date();
  const reservationExpiresAt = new Date(now.getTime() + holdMinutes * 60 * 1000);
  const normalizedCode = String(code).toUpperCase().trim();

  // Reserve only if:
  // - active, not expired, not used, and either not reserved or reservation expired.
  const coupon = await OneTimeCoupon.findOneAndUpdate(
    {
      code: normalizedCode,
      userId,
      isActive: true,
      expiryDate: { $gte: now },
      $expr: { $lt: ['$usedCount', '$usageLimit'] },
      $or: [
        { reservedByCheckoutId: null },
        { reservationExpiresAt: null },
        { reservationExpiresAt: { $lte: now } }
      ]
    },
    {
      $set: {
        reservedByCheckoutId: checkoutId,
        reservedAt: now,
        reservationExpiresAt
      }
    },
    { new: true }
  );

  return coupon; // null if reservation failed
};

export const releaseOneTimeCouponReservation = async ({ code, userId, checkoutId }) => {
  const normalizedCode = String(code).toUpperCase().trim();
  await OneTimeCoupon.updateOne(
    { code: normalizedCode, userId, reservedByCheckoutId: checkoutId },
    {
      $set: {
        reservedByCheckoutId: null,
        reservedAt: null,
        reservationExpiresAt: null
      }
    }
  );
};

export const consumeOneTimeCoupon = async ({
  code,
  userId,
  usedOrderId = null,
  checkoutId = null
}) => {
  const now = new Date();
  const normalizedCode = String(code).toUpperCase().trim();

  const baseQuery = {
    code: normalizedCode,
    userId,
    isActive: true,
    expiryDate: { $gte: now },
    $expr: { $lt: ['$usedCount', '$usageLimit'] }
  };

  // If checkoutId is provided, require that it is reserved by this checkout or reservation is expired.
  const query = checkoutId
    ? {
      ...baseQuery,
      $or: [
        { reservedByCheckoutId: checkoutId },
        { reservationExpiresAt: null },
        { reservationExpiresAt: { $lte: now } }
      ]
    }
    : {
      ...baseQuery,
      $or: [
        { reservedByCheckoutId: null },
        { reservationExpiresAt: null },
        { reservationExpiresAt: { $lte: now } }
      ]
    };

  const coupon = await OneTimeCoupon.findOne(query);
  if (!coupon) return null;

  coupon.usedCount = (coupon.usedCount || 0) + 1;
  coupon.usedAt = now;
  coupon.usedOrderId = usedOrderId || coupon.usedOrderId || null;
  coupon.reservedByCheckoutId = null;
  coupon.reservedAt = null;
  coupon.reservationExpiresAt = null;

  if (coupon.usedCount >= (coupon.usageLimit || 1)) {
    coupon.isActive = false;
  }

  await coupon.save();
  return coupon;
};

