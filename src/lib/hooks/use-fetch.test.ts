import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFetch } from "./use-fetch";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useFetch", () => {
  it("starts with idle state when url is null", () => {
    const { result } = renderHook(() => useFetch(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("starts loading when url is provided", () => {
    const { result } = renderHook(() => useFetch("/api/test"));
    expect(result.current.loading).toBe(true);
  });

  it("fetches data on mount", async () => {
    const mockData = { id: 1, name: "test" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => useFetch("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch errors", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Not found" }),
    });

    const { result } = renderHook(() => useFetch("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it("refetch makes a new request", async () => {
    const mockData = { id: 2 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { result } = renderHook(() => useFetch("/api/test"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);

    const newData = { id: 3 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(newData),
    });

    result.current.refetch();

    await waitFor(() => expect(result.current.data).toEqual(newData));
    expect(result.current.loading).toBe(false);
  });
});
