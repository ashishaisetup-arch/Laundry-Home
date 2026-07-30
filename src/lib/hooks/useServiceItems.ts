import type { ServiceItem } from "@/lib/types";
import { useFetch } from "./use-fetch";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useServiceItems(serviceId: string | null) {
  const url = serviceId ? `/api/service-items?service_id=${serviceId}` : null;
  return useQuery({
    queryKey: queryKeys.serviceItems.byService(serviceId ?? ""),
    queryFn: () => api.get<ServiceItem[]>(url!),
    enabled: !!serviceId,
  });
}
