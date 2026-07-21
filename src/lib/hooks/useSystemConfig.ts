import { useFetch } from "./use-fetch";
import { useCallback } from "react";
import { api } from "@/lib/api/client";

export interface SystemConfig {
  general: {
    platformName: string;
    supportEmail: string;
    supportPhone: string;
    defaultCurrency: string;
    defaultLanguage: string;
    timezone: string;
    allowSignups: boolean;
    allowVendorApps: boolean;
    maintenanceMode: boolean;
    multiCity: boolean;
  };
  payments: {
    upi: boolean;
    cards: boolean;
    netBanking: boolean;
    wallet: boolean;
    cod: boolean;
    internationalCards: boolean;
    gstRate: number;
    platformFee: number;
    deliveryFee: number;
    minOrderValue: number;
  };
  notifications: {
    push: boolean;
    sms: boolean;
    email: boolean;
    whatsapp: boolean;
    events: Record<string, boolean>;
  };
  security: {
    mfaAdmins: boolean;
    mfaVendors: boolean;
    sessionTimeout: boolean;
    ipWhitelist: boolean;
    deviceManagement: boolean;
    jwtRotation: boolean;
    rateLimiting: boolean;
    suspiciousLoginAlerts: boolean;
  };
  limits: {
    maxItemsPerOrder: number;
    maxWeightKg: number;
    expressSurcharge: number;
    expressMultiplier: number;
    freeDeliveryThreshold: number;
    maxServiceRadiusKm: number;
    defaultCommissionRate: number;
    vendorPayoutCycleDays: number;
  };
}

export function useSystemConfig() {
  const { data, loading, error, refetch } = useFetch<SystemConfig>("/api/admin/config");

  const saveConfig = useCallback(async (section: string, values: Record<string, any>) => {
    try {
      const result = await api.patch<SystemConfig>("/api/admin/config", { [section]: values });
      return result;
    } catch (e: any) {
      throw e;
    }
  }, []);

  return { data, loading, error, refetch, saveConfig };
}
