import { useFetch } from "./use-fetch";

export interface PaymentMethod {
  id: string;
  type: string;
  label: string;
  icon: string;
  isDefault: boolean;
}

export function usePaymentMethods() {
  return useFetch<PaymentMethod[]>("/api/wallet/methods");
}
