import { useFetch } from "./use-fetch";

export interface CustomerFeatures {
  enableSubscriptions: boolean;
  enableCoupons: boolean;
  enableWallet: boolean;
  enableLoyalty: boolean;
  enableFavorites: boolean;
  enableReviews: boolean;
  enableDiscover: boolean;
  enableOrders: boolean;
  enableCountItems: boolean;
  enableLaundryBag: boolean;
  enableMixedBooking: boolean;
}

export function useCustomerFeatures() {
  return useFetch<CustomerFeatures>("/api/config/customer");
}