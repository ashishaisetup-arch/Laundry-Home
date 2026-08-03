import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as Response;
}

function mockSupabaseClient(user: { id: string; email: string; user_metadata: Record<string, unknown> } | null | "throw") {
  return {
    auth: {
      getUser: user === "throw" ? vi.fn().mockRejectedValue(new Error("AuthSessionMissingError: Auth session missing!")) : vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
  } as any;
}

describe("store auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie.split(";").forEach((c) => {
      const eq = c.indexOf("=");
      const name = eq > -1 ? c.substring(0, eq).trim() : c.trim();
      document.cookie = `${name}=; path=/; max-age=0;`;
    });
    useAppStore.setState({
      isAuthenticated: false,
      role: "guest",
      authLoading: true,
      userName: "",
      userEmail: "",
      userAvatar: "",
      userPhone: "",
      userId: null,
      authError: null,
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (String(url).includes("/api/auth/session")) {
        return Promise.resolve(jsonResponse({
          user: { email: "ananya@laundryhome.com" },
          profile: { email: "ananya@laundryhome.com", role: "admin", name: "Ananya Iyer", phone: "", avatar: "" },
        }));
      }
      return Promise.resolve(jsonResponse({}));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializeAuth confirms the user via getUser and takes the role from the profile", async () => {
    mockedCreateClient.mockReturnValue(mockSupabaseClient({
      id: "user-1",
      email: "ananya@laundryhome.com",
      user_metadata: { name: "Ananya Iyer", role: "customer" },
    }));

    await useAppStore.getState().initializeAuth();

    const state = useAppStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.role).toBe("admin");
    expect(state.userEmail).toBe("ananya@laundryhome.com");
    expect(state.userName).toBe("Ananya Iyer");
    expect(state.authLoading).toBe(false);
  });

  it("initializeAuth with no authenticated user stays signed out", async () => {
    mockedCreateClient.mockReturnValue(mockSupabaseClient(null));

    await useAppStore.getState().initializeAuth();

    const state = useAppStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.role).toBe("guest");
    expect(state.authLoading).toBe(false);
  });

  it("initializeAuth treats a throwing getUser (no session) as signed out", async () => {
    mockedCreateClient.mockReturnValue(mockSupabaseClient("throw"));

    await expect(useAppStore.getState().initializeAuth()).resolves.toBeUndefined();

    const state = useAppStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.role).toBe("guest");
    expect(state.authLoading).toBe(false);
  });

  it("logout calls the server endpoint and clears storage and cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("theme", "dark");
    sessionStorage.setItem("x", "y");
    document.cookie = "sb-zuayfacnytoougyvvvcl-auth-token=stale; path=/; max-age=3600";

    mockedCreateClient.mockReturnValue({
      auth: { signOut: vi.fn().mockResolvedValue({ error: null }) },
      channel: vi.fn(),
    } as any);

    await useAppStore.getState().logout();

    const logoutCall = fetchMock.mock.calls.find(([url, init]) => String(url) === "/api/auth/logout");
    expect(logoutCall).toBeDefined();
    expect((logoutCall![1] as RequestInit).method).toBe("POST");
    expect(localStorage.getItem("theme")).toBeNull();
    expect(sessionStorage.getItem("x")).toBeNull();
    expect(document.cookie).not.toContain("sb-zuayfacnytoougyvvvcl-auth-token");
  });
});
