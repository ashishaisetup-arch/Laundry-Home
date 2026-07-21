import { useFetch } from "./use-fetch";

export interface Slot {
  id: string;
  slot: string;
  available: boolean;
  premium?: boolean;
}

export interface SlotsResponse {
  pickup: Slot[];
  delivery: Slot[];
}

export function useSlots() {
  return useFetch<SlotsResponse>("/api/slots");
}
