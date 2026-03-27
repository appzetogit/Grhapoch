const toNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

/**
 * Calculate delivery fee based on distance and settings.
 * Formula:
 *  - If distance <= baseDistance: fee = baseFee
 *  - Else: fee = baseFee + (distance - baseDistance) * perKmCharge
 *
 * Throws DELIVERY_DISTANCE_EXCEEDS_MAX_RULE when maxServiceDistance is exceeded.
 */
export const calculateDeliveryFee = (distanceKm, settings = {}) => {
  let distance = toNumber(distanceKm, null);
  if (distance === null || distance < 0) {
    distance = 0;
  }

  const baseDistance = toNumber(settings.baseDistance, 2);
  const baseFee = toNumber(settings.baseFee, 30);
  const perKmCharge = toNumber(settings.perKmCharge, 5);

  const maxServiceDistanceRaw =
    settings.maxServiceDistance !== undefined && settings.maxServiceDistance !== null ?
      settings.maxServiceDistance :
      settings.serviceRadiusKm;
  const maxServiceDistance = toNumber(maxServiceDistanceRaw, null);

  if (maxServiceDistance !== null && distance > maxServiceDistance) {
    throw new Error('DELIVERY_DISTANCE_EXCEEDS_MAX_RULE');
  }

  if (distance <= baseDistance) {
    return Math.round(baseFee);
  }

  const extraDistance = distance - baseDistance;
  const fee = baseFee + extraDistance * perKmCharge;
  return Math.round(fee);
};
