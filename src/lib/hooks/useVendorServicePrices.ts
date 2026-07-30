import type { VendorServicePrice } from "@/lib/types";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useVendorServicePrices(vendorId: string | null) {
  return useQuery({
    queryKey: queryKeys.vendorServicePrices.byVendor(vendorId ?? ""),
    queryFn: () => api.get<VendorServicePrice[]>(`/api/vendor-service-prices/${vendorId}`),
    enabled: !!vendorId,
  });
}
