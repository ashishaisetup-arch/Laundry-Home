import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { execStatus, formatAge, useAdminLiveMap } from "./useAdminLiveMap";
import { api } from "@/lib/api/client";
import { resetRealtimeRegistry } from "./realtimeChannel";

const mocks = vi.hoisted(() => {
  const statusCallbacks: Array<(s: string) => void> = [];
  const payloadCallbacks: Array<(p: any) => void> = [];
  const channel: any = {};
  channel.on = (_evt: string, _opts: any, cb: (p: any) => void) => {
    payloadCallbacks.push(cb);
    return channel;
  };
  channel.subscribe = (cb?: (s: string) => void) => {
    if (cb) statusCallbacks.push(cb);
    return channel;
  };
  const fakeClient = {
    channel: () => channel,
    getChannels: () => [],
    removeChannel: () => {},
  };
  return { fakeClient, channel, statusCallbacks, payloadCallbacks };
});

vi.mock("@/lib/supabase", () => ({
  createClient: () => mocks.fakeClient,
}));

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn() },
}));

const apiGet = vi.mocked(api.get);
const NOW = 1_000_000_000_000;

function Harness() {
  const { executives, connection, vendors } = useAdminLiveMap();
  return (
    <div
      data-testid="h"
      data-execs={JSON.stringify(executives)}
      data-conn={connection}
      data-vendors={String(vendors.length)}
    />
  );
}

const readExecs = () => JSON.parse(screen.getByTestId("h").dataset.execs!) as any[];
const readConn = () => screen.getByTestId("h").dataset.conn!;
const execCalls = () => apiGet.mock.calls.filter((c) => c[0] === "/api/delivery-executives").length;
const locationPayload = (payload: any) => mocks.payloadCallbacks[0](payload);

beforeEach(() => {
  resetRealtimeRegistry();
  vi.clearAllMocks();
  mocks.statusCallbacks.length = 0;
  mocks.payloadCallbacks.length = 0;
  apiGet.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/api/delivery-executives"
        ? [{ id: "exec1", name: "A", currentLat: 1, currentLng: 2, lastSeenAt: null, locationSource: "profile" }]
        : []
    )
  );
});

describe("execStatus", () => {
  it("classifies live under 60s", () => {
    expect(execStatus(new Date(NOW - 59_000).toISOString(), NOW).state).toBe("live");
  });

  it("classifies idle from 60s to 5min", () => {
    expect(execStatus(new Date(NOW - 60_000).toISOString(), NOW).state).toBe("idle");
    expect(execStatus(new Date(NOW - 4 * 60_000 - 59_000).toISOString(), NOW).state).toBe("idle");
  });

  it("classifies offline at 5min and beyond", () => {
    expect(execStatus(new Date(NOW - 5 * 60_000).toISOString(), NOW).state).toBe("offline");
  });

  it("classifies missing lastSeenAt as offline", () => {
    expect(execStatus(null, NOW).state).toBe("offline");
    expect(execStatus(undefined, NOW).state).toBe("offline");
  });

  it("maps states to expected colors", () => {
    expect(execStatus(new Date(NOW - 30_000).toISOString(), NOW).color).toBe("#10b981");
    expect(execStatus(new Date(NOW - 2 * 60_000).toISOString(), NOW).color).toBe("#eab308");
    expect(execStatus(new Date(NOW - 10 * 60_000).toISOString(), NOW).color).toBe("#9ca3af");
  });
});

describe("formatAge", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatAge(new Date(NOW - 38_000).toISOString(), NOW)).toBe("38s ago");
    expect(formatAge(new Date(NOW - 138_000).toISOString(), NOW)).toBe("2m 18s ago");
    expect(formatAge(new Date(NOW - 12 * 60_000).toISOString(), NOW)).toBe("12m 0s ago");
    expect(formatAge(new Date(NOW - 61 * 60_000).toISOString(), NOW)).toBe("1h 1m ago");
  });

  it("returns never when missing", () => {
    expect(formatAge(null, NOW)).toBe("never");
  });
});

describe("useAdminLiveMap realtime", () => {
  it("batches rapid location payloads and keeps the latest per exec without refetching", async () => {
    render(<Harness />);
    await waitFor(() => expect(readExecs()).toHaveLength(1));
    const ts = new Date(Date.now() - 5_000).toISOString();

    locationPayload({ new: { exec_id: "exec1", lat: 10, lng: 20, updated_at: ts } });
    locationPayload({ new: { exec_id: "exec1", lat: 11, lng: 21, updated_at: ts } });
    locationPayload({ new: { exec_id: "exec1", lat: 12, lng: 22, updated_at: ts } });

    await waitFor(() => expect(readExecs()[0].currentLat).toBe(12));
    expect(readExecs()[0].currentLng).toBe(22);
    expect(readExecs()[0].locationSource).toBe("live");
    expect(execCalls()).toBe(1);
  });

  it("ignores out-of-order (older) location payloads", async () => {
    render(<Harness />);
    await waitFor(() => expect(readExecs()).toHaveLength(1));
    const newer = new Date(Date.now() - 1_000).toISOString();
    const older = new Date(Date.now() - 10_000).toISOString();

    locationPayload({ new: { exec_id: "exec1", lat: 50, lng: 51, updated_at: newer } });
    await waitFor(() => expect(readExecs()[0].currentLat).toBe(50));

    locationPayload({ new: { exec_id: "exec1", lat: 60, lng: 61, updated_at: older } });
    await new Promise((r) => setTimeout(r, 150));
    expect(readExecs()[0].currentLat).toBe(50);
    expect(readExecs()[0].currentLng).toBe(51);
  });

  it("runs loadAll exactly once when the channel reconnects", async () => {
    render(<Harness />);
    await waitFor(() => expect(execCalls()).toBe(1));

    locationPayload({ new: { exec_id: "exec1", lat: 30, lng: 31, updated_at: new Date(Date.now() - 5_000).toISOString() } });

    mocks.statusCallbacks.forEach((cb) => cb("CLOSED"));
    await waitFor(() => expect(readConn()).toBe("offline"));

    mocks.statusCallbacks.forEach((cb) => cb("SUBSCRIBED"));
    await waitFor(() => expect(readConn()).toBe("live"));
    await waitFor(() => expect(execCalls()).toBe(2));

    await new Promise((r) => setTimeout(r, 50));
    expect(execCalls()).toBe(2);
  });

  it("does not reconcile on the initial subscribe", async () => {
    render(<Harness />);
    await waitFor(() => expect(execCalls()).toBe(1));

    mocks.statusCallbacks.forEach((cb) => cb("SUBSCRIBED"));
    await new Promise((r) => setTimeout(r, 50));
    expect(execCalls()).toBe(1);
  });
});
