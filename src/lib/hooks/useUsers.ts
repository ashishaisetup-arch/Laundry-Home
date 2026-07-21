import { useFetch } from "./use-fetch";
import { useState, useCallback } from "react";
import { api } from "@/lib/api/client";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  avatar: string;
  status: "active" | "suspended";
  lastActive: string;
  joined: string;
}

export function useUsers() {
  const { data, loading, error, refetch } = useFetch<AdminUser[]>("/api/admin/users");
  const [updating, setUpdating] = useState(false);

  const updateUser = useCallback(async (id: string, updates: Partial<AdminUser>) => {
    setUpdating(true);
    try {
      await api.patch(`/api/admin/users/${id}`, updates);
      refetch();
    } finally {
      setUpdating(false);
    }
  }, [refetch]);

  return { data: data || [], loading, error, refetch, updateUser, updating };
}
