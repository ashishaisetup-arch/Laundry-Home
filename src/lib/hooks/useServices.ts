import type { ServiceType } from "@/lib/types";
import { useFetch } from "./use-fetch";

export function useServices() {
  return useFetch<ServiceType[]>("/api/services");
}
