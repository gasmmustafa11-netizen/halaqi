// Calculate distance between two GPS coordinates using Haversine formula
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function formatDistance(distanceKm: number, isRtl: boolean = true): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return isRtl ? `${meters} م` : `${meters} m`;
  }
  return isRtl ? `${distanceKm} كم` : `${distanceKm} km`;
}

export function estimateDriveTimeMinutes(distanceKm: number): number {
  // Assuming average city speed of ~25 km/h + traffic factor
  const speedKmH = 25;
  const timeHours = distanceKm / speedKmH;
  return Math.max(3, Math.round(timeHours * 60));
}

export function getGoogleMapsNavigationUrl(lat: number, lng: number, placeName?: string): string {
  if (placeName) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(placeName)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
