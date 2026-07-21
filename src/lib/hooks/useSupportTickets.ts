import { useFetch } from "./use-fetch";

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  createdAt: string;
}

export function useSupportTickets(status?: string) {
  const query = status ? `?status=${status}` : "";
  return useFetch<SupportTicket[]>(`/api/support/tickets${query}`);
}
