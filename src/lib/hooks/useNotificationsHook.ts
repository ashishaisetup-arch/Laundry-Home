import { useFetch } from "./use-fetch";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function useNotifications() {
  return useFetch<Notification[]>("/api/notifications");
}
