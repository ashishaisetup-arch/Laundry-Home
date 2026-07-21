import type { Vendor } from "@/lib/types";
import { useFetch } from "./use-fetch";

interface UseVendorsParams {
  area?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export function useVendors(params?: UseVendorsParams) {
  const query = params
    ? "?" + new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
      ).toString()
    : "";
  return useFetch<Vendor[]>(`/api/vendors${query}`);
}

export function useVendor(id: string) {
  return useFetch<Vendor>(`/api/vendors/${id}`);
}
