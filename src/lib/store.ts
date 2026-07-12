import { create } from "zustand";
import type { Role, Notification, ChatMessage } from "./types";
import { NOTIFICATIONS } from "./mock-data";

interface AppState {
  // Auth
  role: Role;
  isAuthenticated: boolean;
  userName: string;
  userEmail: string;
  userAvatar: string;
  login: (role: Role) => void;
  logout: () => void;
  switchRole: (role: Role) => void;

  // UI state
  theme: "light" | "dark";
  sidebarOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;

  // AI Assistant
  aiChat: ChatMessage[];
  aiOpen: boolean;
  toggleAi: () => void;
  setAiOpen: (open: boolean) => void;
  sendAiMessage: (content: string) => void;
  clearAiChat: () => void;

  // Wallet
  walletBalance: number;
  loyaltyPoints: number;
}

const AI_GREETING: ChatMessage = {
  id: "ai-0",
  role: "assistant",
  content:
    "Hi! I'm your Laundry Home AI assistant. I can help you with vendor recommendations, price estimates, delivery predictions, and demand insights. What would you like to know?",
  time: "now",
};

function generateAiReply(userMsg: string): string {
  const msg = userMsg.toLowerCase();
  if (msg.includes("vendor") || msg.includes("recommend")) {
    return "Based on your location (Indiranagar) and past orders, I recommend **FreshFold Laundry Co.** — 4.8★ rating, 1.2km away, 24hr turnaround, 78% repeat customer rate. For premium items, **Royal Garment Care** specialises in silk and designer wear. Want me to auto-assign the best vendor for your next order?";
  }
  if (msg.includes("price") || msg.includes("cost") || msg.includes("estimate")) {
    return "For 5kg Wash & Fold + 6 shirts Wash & Iron at FreshFold, the estimated cost is **₹525** (including 18% GST, ₹25 platform fee, ₹40 delivery). Express delivery adds 1.5× on service cost. Apply coupon FRESH50 to save up to ₹150 on your first order.";
  }
  if (msg.includes("delay") || msg.includes("predict")) {
    return "Order LH-2849 has a **medium delay risk** (confidence 91%) — vendor capacity is at 78% and pickup slot is 2-4 PM which is a peak window. Recommended action: reassign to QuickClean Express (45% capacity, 11hr turnaround) to bring delivery on time.";
  }
  if (msg.includes("demand") || msg.includes("forecast")) {
    return "Demand forecast for this weekend: **+28% in HSR Layout** and **+22% in Whitefield**. Recommend onboarding 2 more vendors in these zones. Friday-Saturday will see 312 and 268 pickups respectively — pre-position 4 delivery executives in Indiranagar hub.";
  }
  if (msg.includes("track") || msg.includes("order")) {
    return "Your active order LH-2847 is currently in the **Washing** stage (step 9/18). Estimated completion in 14 hours. Pickup was completed on time, and AI predicts low delay risk. Want me to send a real-time notification when it reaches the Ironing stage?";
  }
  return "I can help with: vendor recommendations, price estimation, delivery time prediction, delay alerts, demand forecasting, and personalised subscription plans. Try asking \"Which vendor is best for my next order?\" or \"Predict delivery time for my active order.\"";
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  role: "guest",
  isAuthenticated: false,
  userName: "Aarav Mehta",
  userEmail: "aarav.mehta@email.com",
  userAvatar: "AM",

  login: (role) =>
    set({
      role,
      isAuthenticated: true,
      userName:
        role === "customer" ? "Aarav Mehta"
        : role === "vendor" ? "FreshFold Laundry Co."
        : role === "delivery" ? "Rajesh Kumar"
        : role === "admin" ? "Ananya Iyer"
        : role === "superadmin" ? "System Admin"
        : "Guest",
      userEmail:
        role === "customer" ? "aarav.mehta@email.com"
        : role === "vendor" ? "owner@freshfold.co"
        : role === "delivery" ? "rajesh.k@delivery.co"
        : role === "admin" ? "ananya@laundryhome.com"
        : "admin@laundryhome.com",
      userAvatar:
        role === "customer" ? "AM"
        : role === "vendor" ? "FF"
        : role === "delivery" ? "RK"
        : role === "admin" ? "AI"
        : "SA",
    }),

  logout: () =>
    set({
      role: "guest",
      isAuthenticated: false,
      sidebarOpen: false,
    }),

  switchRole: (role) =>
    set({
      role,
      userName:
        role === "customer" ? "Aarav Mehta"
        : role === "vendor" ? "FreshFold Laundry Co."
        : role === "delivery" ? "Rajesh Kumar"
        : role === "admin" ? "Ananya Iyer"
        : role === "superadmin" ? "System Admin"
        : "Guest",
      userEmail:
        role === "customer" ? "aarav.mehta@email.com"
        : role === "vendor" ? "owner@freshfold.co"
        : role === "delivery" ? "rajesh.k@delivery.co"
        : role === "admin" ? "ananya@laundryhome.com"
        : "admin@laundryhome.com",
      userAvatar:
        role === "customer" ? "AM"
        : role === "vendor" ? "FF"
        : role === "delivery" ? "RK"
        : role === "admin" ? "AI"
        : "SA",
    }),

  // UI
  theme: "light",
  sidebarOpen: false,
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),

  // Notifications
  notifications: NOTIFICATIONS,
  unreadCount: NOTIFICATIONS.filter((n) => !n.read).length,
  markNotificationRead: (id) =>
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    }),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  // AI Assistant
  aiChat: [AI_GREETING],
  aiOpen: false,
  toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),
  setAiOpen: (open) => set({ aiOpen: open }),
  sendAiMessage: (content) => {
    const userMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      role: "user",
      content,
      time: "now",
    };
    set((s) => ({ aiChat: [...s.aiChat, userMsg] }));

    // Simulate AI reply after delay
    setTimeout(() => {
      const reply: ChatMessage = {
        id: `ai-${Date.now()}-r`,
        role: "assistant",
        content: generateAiReply(content),
        time: "now",
      };
      set((s) => ({ aiChat: [...s.aiChat, reply] }));
    }, 800);
  },
  clearAiChat: () => set({ aiChat: [AI_GREETING] }),

  // Wallet
  walletBalance: 1250,
  loyaltyPoints: 2480,
}));
