import { useFetch } from "./use-fetch";

export interface Staff {
  id: string;
  vendorId: string;
  name: string;
  role: string;
  shift: string;
  status: string;
  rating: number;
  ordersToday: number;
  phone: string;
  active: boolean;
}

export function useStaff(vendorId?: string) {
  const query = vendorId ? `?vendorId=${vendorId}` : "";
  return useFetch<Staff[]>(`/api/vendor/staff${query}`);
}
