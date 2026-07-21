import { useFetch } from "./use-fetch";
import { useCallback } from "react";
import { api } from "@/lib/api/client";

export interface Role {
  name: string;
  label: string;
  description: string;
  isSystemRole: boolean;
}

export interface RolePermission {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
}

export interface RbacData {
  roles: Role[];
  permissions: RolePermission[];
  permissionByRole: Record<string, RolePermission[]>;
}

export function useRbac() {
  const { data, loading, error, refetch } = useFetch<RbacData>("/api/admin/rbac");

  const togglePermission = useCallback(async (id: string, allowed: boolean) => {
    await api.patch(`/api/admin/rbac/${id}`, { allowed });
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, togglePermission };
}
