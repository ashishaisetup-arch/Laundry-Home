import type { CatalogCategory } from "@/lib/types";
import { useFetch } from "./use-fetch";

export function useServiceCatalog(options?: { includeInactive?: boolean }) {
  const url = options?.includeInactive
    ? "/api/services/catalog?includeInactive=true"
    : "/api/services/catalog";
  return useFetch<CatalogCategory[]>(url);
}
