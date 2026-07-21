import { useFetch } from "./use-fetch";

export interface UserSubscription {
  id: string;
  planId: string;
  planName: string;
  status: string;
  interval: string;
  createdAt: string;
}

export function useUserSubscriptions() {
  return useFetch<UserSubscription[]>("/api/subscriptions");
}
