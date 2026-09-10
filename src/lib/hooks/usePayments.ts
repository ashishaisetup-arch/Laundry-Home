import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { useAppStore } from "@/lib/store";

// ============================================================================
// Types (camelCase — api.get() auto-converts snake_case responses)
// ============================================================================

export interface PaymentTransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}

export interface PaymentSummary {
  walletBalance: number;
  totalSpentSixMonths: number;
  moneySaved: number;
  transactionCount: number;
  invoiceCount: number;
}

export interface TransactionRow {
  id: string;
  type: string;
  amount: number;
  method: string | null;
  description: string | null;
  orderId: string | null;
  status: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
}

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string | null;
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  status: string;
}

interface TransactionResponse {
  transactions: TransactionRow[];
  total: number;
  page: number;
  limit: number;
}

interface InvoiceResponse {
  invoices: InvoiceRow[];
  total: number;
  page: number;
  limit: number;
}

export interface TopupOrderResponse {
  success: boolean;
  transactionId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  publicKeyId: string;
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  alreadyCredited?: boolean;
  walletTransactionId?: string | null;
  newBalance?: number;
  error?: string;
}

// ============================================================================
// READ Hooks
// ============================================================================

export function usePaymentSummary() {
  return useQuery<PaymentSummary>({
    queryKey: queryKeys.payments.summary,
    queryFn: () => api.get<PaymentSummary>("/api/customer/payments/summary"),
  });
}

export function useTransactions(filters: PaymentTransactionFilters = {}) {
  return useQuery<TransactionResponse>({
    queryKey: queryKeys.payments.transactions(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.type) params.set("type", filters.type);
      if (filters.status) params.set("status", filters.status);
      const qs = params.toString();
      return api.get(`/api/customer/payments/transactions${qs ? `?${qs}` : ""}`);
    },
  });
}

export function useInvoices(page = 1) {
  return useQuery<InvoiceResponse>({
    queryKey: queryKeys.payments.invoices(page),
    queryFn: () => api.get(`/api/customer/invoices?page=${page}&limit=20`),
  });
}

// ============================================================================
// MUTATION Hooks
// ============================================================================

export function useCreateTopupOrder() {
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: { amount: number; idempotencyKey: string }) =>
      api.post<TopupOrderResponse>("/api/payments/wallet/topup/create-order", {
        amount,
        idempotencyKey,
      }),
  });
}

export function useVerifyTopupPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
      transaction_id: string;
    }) => api.post<VerifyResponse>("/api/payments/wallet/topup/verify", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.summary });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.transactionsAll });
      void useAppStore.getState().fetchWallet();
    },
  });
}
