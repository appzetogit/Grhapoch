/**
 * Deprecated: app now uses service-radius based flow instead of zone-based gating.
 * Keep this hook as a no-op export to avoid import breakage in legacy screens.
 */
export function useZone() {
  return {
    zoneId: null,
    zone: null,
    zoneStatus: 'IN_SERVICE',
    loading: false,
    error: null,
    isInService: true,
    isOutOfService: false,
    refreshZone: () => {}
  };
}
