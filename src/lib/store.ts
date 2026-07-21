import { create } from "zustand";
import type { Role, Notification, ChatMessage } from "./types";
import { createClient } from "./supabase";
import { api } from "./api/client";

let notifChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

interface AppState {
  // Auth
  role: Role;
  isAuthenticated: boolean;
  userName: string;
  userEmail: string;
  userAvatar: string;
  userPhone: string;
  userId: string | null;
  authLoading: boolean;
  authError: string | null;

  initializeAuth: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  signInWithOAuth: (provider: "google" | "apple" | "microsoft") => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setProfile: (name: string, phone: string, email?: string) => Promise<void>;

  // UI state
  theme: "light" | "dark";
  sidebarOpen: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;

  // Notifications
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setupRealtimeNotifications: () => void;

  // AI Assistant
  aiChat: ChatMessage[];
  aiOpen: boolean;
  toggleAi: () => void;
  setAiOpen: (open: boolean) => void;
  sendAiMessage: (content: string) => Promise<void>;
  clearAiChat: () => void;

  // Wallet
  walletBalance: number;
  loyaltyPoints: number;
  fetchWallet: () => Promise<void>;

  // Orders
  orders: any[];
  setOrders: (orders: any[]) => void;
  patchOrder: (id: string, updates: Record<string, unknown>) => void;
}



export const useAppStore = create<AppState>((set, get) => ({
  // Auth
  role: "guest",
  isAuthenticated: false,
  userName: "",
  userEmail: "",
  userAvatar: "",
  userPhone: "",
  userId: null,
  authLoading: true,
  authError: null,

  initializeAuth: async () => {
    if (sessionStorage.getItem("lh_logged_out")) {
      sessionStorage.removeItem("lh_logged_out");
      set({ authLoading: false });
      return;
    }
    try {
      const supabase = createClient();
      const url = new URL(window.location.href);
      const hasCode = url.searchParams.has("code");

      if (hasCode) {
        const code = url.searchParams.get("code")!;
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn("[auth] exchangeCodeForSession failed:", error.message);
        } else if (data?.session) {
          const session = data.session;
          const meta = session.user.user_metadata;
          const role: Role = (meta?.role as Role) || "customer";
          const name = meta?.name || session.user.email?.split("@")[0] || "User";
          const avatar = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState(window.history.state, "", url.toString());

          fetch("/api/auth/session").catch(() => {});

          set({
            isAuthenticated: true,
            role,
            userId: session.user.id,
            userName: name,
            userEmail: session.user.email || "",
            userAvatar: avatar,
            authLoading: false,
          });
          get().fetchNotifications().catch(() => {});
          get().fetchWallet().catch(() => {});
          get().setupRealtimeNotifications();
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          get().fetchNotifications().catch(() => {});
          get().fetchWallet().catch(() => {});
          get().setupRealtimeNotifications();
          const meta = session.user.user_metadata;
          const role: Role = (meta?.role as Role) || "customer";
          const name = meta?.name || session.user.email?.split("@")[0] || "User";
          const avatar = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

          try {
            const res = await fetch("/api/auth/session");
            const data = await res.json();
            if (data.profile) {
              set({
                isAuthenticated: true,
                role: data.profile.role || role,
                userId: session.user.id,
                userName: data.profile.name || name,
                userEmail: data.profile.email || session.user.email || "",
                userPhone: data.profile.phone || "",
                userAvatar: data.profile.avatar || avatar,
                authLoading: false,
              });
              return;
            }
          } catch {}

          set({
            isAuthenticated: true,
            role,
            userId: session.user.id,
            userName: name,
            userEmail: session.user.email || "",
            userAvatar: avatar,
            authLoading: false,
          });
          get().fetchNotifications().catch(() => {});
          get().fetchWallet().catch(() => {});
          get().setupRealtimeNotifications();
          return;
        }
    } catch (e) {
      console.warn("[auth] initializeAuth error:", e);
    }
    const url = new URL(window.location.href);
    if (url.searchParams.has("code")) {
      url.searchParams.delete("code");
      window.history.replaceState(window.history.state, "", url.toString());
    }
    set({ authLoading: false });
  },

  signInWithEmail: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = data.user?.id || null;
      const meta = data.user?.user_metadata;
      const name = meta?.name || data.user?.email?.split("@")[0] || "User";
      const avatar = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

      let role: Role = (meta?.role as Role) || "customer";
      let userName = name;
      let userEmail = data.user?.email || "";
      let userPhone = "";

      try {
        const res = await fetch("/api/auth/session");
        const d = await res.json();
        if (d.profile) {
          role = d.profile.role || role;
          userName = d.profile.name || userName;
          userEmail = d.profile.email || userEmail;
          userPhone = d.profile.phone || "";
        }
      } catch {}

      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has("clear") || u.searchParams.has("landing")) {
          u.searchParams.delete("clear");
          u.searchParams.delete("landing");
          window.history.replaceState(window.history.state, "", u.toString());
        }
      } catch {}

      set({
        isAuthenticated: true,
        role,
        userId,
        userName,
        userEmail,
        userPhone,
        userAvatar: avatar,
      });

      get().fetchNotifications().catch(() => {});
      get().fetchWallet().catch(() => {});
      get().setupRealtimeNotifications();
    } catch (e: any) {
      set({ authError: e.message || "Sign in failed", authLoading: false });
      throw e;
    }
    set({ authLoading: false });
  },

  signInWithPhone: async (phone) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  },

  verifyOtp: async (phone, token) => {
    set({ authLoading: true, authError: null });
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      if (error) throw error;

      const userId = data.user?.id || null;
      let role: Role = "customer";
      let userName = "User";
      let userEmail = "";
      let userPhone = phone;

      try {
        const res = await fetch("/api/auth/session");
        const d = await res.json();
        if (d.profile) {
          role = d.profile.role || role;
          userName = d.profile.name || userName;
          userEmail = d.profile.email || "";
          userPhone = d.profile.phone || phone;
        }
      } catch {}

      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has("clear") || u.searchParams.has("landing")) {
          u.searchParams.delete("clear");
          u.searchParams.delete("landing");
          window.history.replaceState(window.history.state, "", u.toString());
        }
      } catch {}

      set({
        isAuthenticated: true,
        role,
        userId,
        userName,
        userEmail,
        userPhone,
        userAvatar: "US",
      });

      get().fetchNotifications().catch(() => {});
      get().fetchWallet().catch(() => {});
      get().setupRealtimeNotifications();
    } catch (e: any) {
      set({ authError: e.message || "Verification failed", authLoading: false });
      throw e;
    }
    set({ authLoading: false });
  },

  signInWithOAuth: async (provider) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  },

  signUp: async (email, password, name?) => {
    set({ authLoading: true, authError: null });
    try {
      const displayName = name || email.split("@")[0] || "User";
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { role: "customer", name: displayName } },
      });
      if (error) throw error;

      if (data.user) {
        const role: Role = "customer";
        const avatar = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

        try {
          const u = new URL(window.location.href);
          if (u.searchParams.has("clear") || u.searchParams.has("landing")) {
            u.searchParams.delete("clear");
            u.searchParams.delete("landing");
            window.history.replaceState(window.history.state, "", u.toString());
          }
        } catch {}

        set({
          isAuthenticated: true,
          role,
          userId: data.user.id,
          userName: displayName,
          userEmail: data.user.email || "",
          userAvatar: avatar,
        });

        get().fetchNotifications().catch(() => {});
        get().fetchWallet().catch(() => {});
        get().setupRealtimeNotifications();
      }
    } catch (e: any) {
      set({ authError: e.message || "Sign up failed", authLoading: false });
      throw e;
    }
    set({ authLoading: false });
  },

  logout: async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      const eq = c.indexOf("=");
      const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
      for (const p of ["/", "/api", "/auth"]) {
        document.cookie = `${name}=; path=${p}; max-age=0;`;
        document.cookie = `${name}=; path=${p}; domain=${window.location.hostname}; max-age=0;`;
      }
    });
    window.location.href = "/?clear=1";
  },

  setProfile: async (name, phone, email?) => {
    try {
      const res = await api.patch<{ profile: { name: string; phone: string; email: string; avatar: string } }>("/api/auth/profile", { name, phone, email });
      if (res?.profile) {
        set({
          userName: res.profile.name || name,
          userPhone: res.profile.phone || phone,
          userEmail: res.profile.email || email || "",
          userAvatar: res.profile.avatar || "",
          authError: null,
        });
      } else {
        set({ userName: name, userPhone: phone, authError: null });
      }
    } catch (e: any) {
      set({ authError: e.message });
      throw e;
    }
  },

  // UI
  theme: "light",
  sidebarOpen: false,
  toggleTheme: () => set((s) => ({ theme: s.theme === "light" ? "dark" : "light" })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),

  // Notifications
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {
    try {
      const data = await api.get<Notification[]>("/api/notifications");
      const notifs = data || [];
      set({ notifications: notifs, unreadCount: notifs.filter((n: Notification) => !n.read).length });
    } catch {}
  },
  markNotificationRead: async (id) => {
    try {
      await api.patch(`/api/notifications/${id}`, { read: true });
      set((s) => {
        const updated = s.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        return { notifications: updated, unreadCount: updated.filter((n) => !n.read).length };
      });
    } catch {}
  },
  markAllRead: async () => {
    try {
      await Promise.all(
        get().notifications.filter((n) => !n.read).map((n) =>
          api.patch(`/api/notifications/${n.id}`, { read: true })
        )
      );
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  // AI Assistant
  aiChat: [],
  aiOpen: false,
  toggleAi: () => set((s) => ({ aiOpen: !s.aiOpen })),
  setAiOpen: (open) => set({ aiOpen: open }),
  sendAiMessage: async (content) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content, time: new Date().toLocaleTimeString() };
    set((s) => ({ aiChat: [...s.aiChat, userMsg] }));
    try {
      const res = await api.post<{ reply: string }>("/api/chat/ask", { content });
      const reply: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: res.reply, time: new Date().toLocaleTimeString() };
      set((s) => ({ aiChat: [...s.aiChat, reply] }));
    } catch (e) {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "Sorry, I couldn't process that request. Please try again.", time: new Date().toLocaleTimeString() };
      set((s) => ({ aiChat: [...s.aiChat, errMsg] }));
    }
  },
  clearAiChat: async () => {
    set({ aiChat: [] });
  },

  // Wallet
  walletBalance: 0,
  loyaltyPoints: 0,
  fetchWallet: async () => {
    try {
      const data = await api.get<{ balance: number; loyaltyPoints: number }>("/api/wallet");
      if (data) {
        set({ walletBalance: data.balance || 0, loyaltyPoints: data.loyaltyPoints || 0 });
      }
    } catch {}
  },

  // Orders
  orders: [],
  setOrders: (orders: any[]) => set({ orders }),
  patchOrder: (id: string, updates: Record<string, unknown>) => {
    set((s) => ({
      orders: s.orders.map((o: any) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    }));
  },

  setupRealtimeNotifications: () => {
    const state = get();
    if (!state.isAuthenticated || !state.userId) return;
    if (notifChannel) return;

    const supabase = createClient();
    notifChannel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${state.userId}`,
        },
        (payload: any) => {
          const newNotif: Notification = {
            id: payload.new.id,
            type: payload.new.type || "system",
            title: payload.new.title || "",
            body: payload.new.body || "",
            time: payload.new.created_at || new Date().toISOString(),
            read: payload.new.read || false,
            channel: payload.new.channel || "push",
          };
          set((s) => ({
            notifications: [newNotif, ...s.notifications],
            unreadCount: s.unreadCount + 1,
          }));
        }
      )
      .subscribe();
  },
}));
