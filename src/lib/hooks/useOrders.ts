import type { Order } from "@/lib/types";
import { useFetch } from "./use-fetch";
import { useRealtime } from "./useRealtime";

export function useOrders(params?: { vendorId?: string | null; customerId?: string; status?: string; limit?: number; admin?: string; deliveryExecutiveId?: string }) {
  const cleanParams = params
    ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== ""))
    : undefined;
  const hasParams = cleanParams && Object.keys(cleanParams).length > 0;
  const url = hasParams ? `/api/orders?${new URLSearchParams(cleanParams as Record<string, string>).toString()}` : "/api/orders";
  const result = useFetch<Order[]>(url);

  const customerFilter = params?.customerId ? `customer_id=eq.${params.customerId}` : undefined;
  useRealtime("orders", customerFilter, result.refetch, !!params?.customerId);

  const vendorFilter = params?.vendorId ? `vendor_id=eq.${params.vendorId}` : undefined;
  useRealtime("orders", vendorFilter, result.refetch, !!params?.vendorId);

  const execFilter = params?.deliveryExecutiveId ? `delivery_executive_id=eq.${params.deliveryExecutiveId}` : undefined;
  useRealtime("orders", execFilter, result.refetch, !!params?.deliveryExecutiveId);

  return result;
}

export function useOrder(id: string) {
  const result = useFetch<Order>(`/api/orders/${id}`);

  const filter = id ? `id=eq.${id}` : undefined;
  useRealtime("orders", filter, result.refetch, !!id);

  return result;
}
