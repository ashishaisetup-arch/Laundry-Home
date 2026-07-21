import { useFetch } from "./use-fetch";
import { useState, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface ApiKey {
  id: string;
  name: string;
  keyValue: string;
  enabled: boolean;
  lastUsedAt: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

export function useApiKeys() {
  return useFetch<ApiKey[]>("/api/admin/integrations/api-keys");
}

export function useWebhooks() {
  return useFetch<Webhook[]>("/api/admin/integrations/webhooks");
}
