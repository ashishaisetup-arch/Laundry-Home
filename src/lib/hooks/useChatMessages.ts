import { useFetch } from "./use-fetch";

export interface ChatMessage {
  id: string;
  userId: string;
  role: string;
  content: string;
  createdAt: string;
}

export function useChatMessages() {
  return useFetch<ChatMessage[]>("/api/chat");
}
