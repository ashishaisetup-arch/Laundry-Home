import { useFetch } from "./use-fetch";

export interface Garment {
  id: string;
  vendorId: string;
  name: string;
  category: string;
  stock: number;
  inUse: number;
  damaged: number;
  price: number;
}

export function useGarments(vendorId?: string) {
  const query = vendorId ? `?vendorId=${vendorId}` : "";
  return useFetch<Garment[]>(`/api/garments${query}`);
}
