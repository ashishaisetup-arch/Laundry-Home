import { useFetch } from "./use-fetch";

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function useFeatureFlags() {
  return useFetch<FeatureFlag[]>("/api/admin/features");
}
