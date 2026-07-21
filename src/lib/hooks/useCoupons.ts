import type { Coupon } from "@/lib/types";
import { useFetch } from "./use-fetch";

export function useCoupons() {
  return useFetch<Coupon[]>("/api/coupons");
}
