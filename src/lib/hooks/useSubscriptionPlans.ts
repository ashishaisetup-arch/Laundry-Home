import { useFetch } from "./use-fetch";

export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular: boolean;
  color: string;
}

export function useSubscriptionPlans() {
  return useFetch<SubscriptionPlan[]>("/api/subscriptions/plans");
}
