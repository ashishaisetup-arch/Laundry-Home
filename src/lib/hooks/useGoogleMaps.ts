export function useGoogleMapsAvailable() {
  return !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
}
