import type { Address } from "@/lib/types";
import { useFetch } from "./use-fetch";

export function useAddresses() {
  return useFetch<Address[]>("/api/addresses");
}
