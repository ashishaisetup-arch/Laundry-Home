import { useFetch } from "./use-fetch";

export interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  budget: number;
  spent: number;
  reach: number;
  conversions: number;
}

export function useCampaigns() {
  return useFetch<Campaign[]>("/api/admin/campaigns");
}
