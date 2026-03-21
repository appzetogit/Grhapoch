export function normalizePlatform(rawPlatform, body = {}) {
  const platform = String(rawPlatform || body.platform || 'app').toLowerCase().trim();
  const deviceType = String(body.deviceType || body.device || body.os || '').toLowerCase().trim();

  if (platform === 'web' || platform === 'browser' || platform === 'pwa') {
    return 'web';
  }

  if (platform === 'ios' || platform === 'iphone' || platform === 'ipad') {
    return 'ios';
  }

  if (platform === 'android') {
    return 'android';
  }

  // Backward compatibility: app/mobile tokens default to Android unless explicit iOS hint is provided.
  if (platform === 'app' || platform === 'mobile') {
    if (deviceType === 'ios' || deviceType === 'iphone' || deviceType === 'ipad') {
      return 'ios';
    }
    return 'android';
  }

  return 'android';
}

export function getTokenFieldForPlatform(platform) {
  if (platform === 'web') return 'fcmTokenWeb';
  if (platform === 'ios') return 'fcmTokenIos';
  return 'fcmTokenAndroid';
}

export function extractTokenPayload(req) {
  const body = req.body || {};
  const token = body.token || body.fcmToken || body.fcm_token || req.query?.token || '';
  const normalizedPlatform = normalizePlatform(body.platform || req.query?.platform, body);
  return { token, platform: normalizedPlatform };
}
