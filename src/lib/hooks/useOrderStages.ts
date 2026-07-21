import { useFetch } from "./use-fetch";

export interface OrderStageDef {
  stage: string;
  label: string;
  sortOrder: number;
}

export function useOrderStages() {
  return useFetch<OrderStageDef[]>("/api/order-stages");
}
