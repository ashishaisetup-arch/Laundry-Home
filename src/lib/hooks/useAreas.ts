import { useFetch } from "./use-fetch";

export function useCities() {
  return useFetch<{ id: string; name: string; state: string }[]>("/api/areas/cities");
}

export function useAreas(city?: string) {
  const url = city ? `/api/areas?city=${encodeURIComponent(city)}` : "/api/areas";
  return useFetch<any[]>(url);
}

export function useVendorAreas(vendorId?: string) {
  const url = vendorId ? `/api/areas/vendor/${vendorId}` : null;
  return useFetch<any[]>(url);
}

export function useAreaWaitlist() {
  return useFetch<any[]>("/api/areas/waitlist");
}
