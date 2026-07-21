import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Order } from "@/lib/types";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { useRealtime } from "./useRealtime";

function buildOrdersUrl(params?: Record<string, string | null | undefined>): string {
  const clean = params
    ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ""))
    : undefined;
  return clean && Object.keys(clean).length > 0
    ? `/api/orders?${new URLSearchParams(clean as Record<string, string>).toString()}`
    : "/api/orders";
}

export function useOrders(params?: { vendorId?: string | null; customerId?: string; status?: string; limit?: number; admin?: string; deliveryExecutiveId?: string }) {
  const queryClient = useQueryClient();
  const url = buildOrdersUrl(params as Record<string, string | null | undefined>);
  const queryKey = queryKeys.orders.list(url);

  const result = useQuery<Order[]>({
    queryKey,
    queryFn: () => api.get<Order[]>(url),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });

  const customerFilter = params?.customerId ? `customer_id=eq.${params.customerId}` : undefined;
  useRealtime("orders", customerFilter, invalidate, !!params?.customerId);

  const vendorFilter = params?.vendorId ? `vendor_id=eq.${params.vendorId}` : undefined;
  useRealtime("orders", vendorFilter, invalidate, !!params?.vendorId);

  const execFilter = params?.deliveryExecutiveId ? `delivery_executive_id=eq.${params.deliveryExecutiveId}` : undefined;
  useRealtime("orders", execFilter, invalidate, !!params?.deliveryExecutiveId);

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: () => { queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }); },
  };
}

export function useOrder(id: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.orders.detail(id);

  const result = useQuery<Order>({
    queryKey,
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
  });

  const filter = id ? `id=eq.${id}` : undefined;
  useRealtime("orders", filter, () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }), !!id);

  return {
    data: result.data ?? null,
    loading: result.isLoading,
    error: result.error?.message ?? null,
    refetch: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  };
}
