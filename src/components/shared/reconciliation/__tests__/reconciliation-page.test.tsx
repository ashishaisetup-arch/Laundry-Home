import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReconciliationPage } from "../reconciliation-page";
import type { ReconciliationFinding, ReconciliationFindingsResponse } from "@/lib/types";

const { useFetchMock, reconPostMock, toastMock } = vi.hoisted(() => ({
  useFetchMock: vi.fn(),
  reconPostMock: vi.fn(),
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/hooks/use-fetch", () => ({
  useFetch: (url: string | null) => useFetchMock(url),
}));

vi.mock("../recon-api", () => ({
  reconPost: (url: string, body?: unknown) =>
    body !== undefined ? reconPostMock(url, body) : reconPostMock(url),
  transitionUrl: (id: string, action: string) =>
    `/api/admin/reconciliation/findings/${id}/${action}`,
  MANUAL_RUN_URL: "/api/admin/reconciliation/run",
}));

vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/components/shared/stat-card", () => ({
  StatCard: ({ label, value }: { label: string; value: string }) => (
    <div data-testid="stat-card" data-label={label} data-value={value} />
  ),
}));

const OPEN: ReconciliationFinding = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  checkCode: "C5",
  severity: "warning",
  subjectType: "payment",
  subjectId: "pay_abc123",
  summary: "Ledger payment mismatch",
  details: {},
  status: "open",
  firstDetectedAt: "2026-10-09T08:00:00.000Z",
  lastDetectedAt: "2026-10-09T09:00:00.000Z",
  occurrenceCount: 3,
  resolvedAt: null,
  resolutionNote: null,
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedBy: null,
  createdAt: "2026-10-09T08:00:00.000Z",
};

const ACKED: ReconciliationFinding = {
  ...OPEN,
  id: "bbbbbbbb-0000-4000-8000-000000000002",
  checkCode: "C1",
  summary: "Refund reconciliation required",
  subjectType: "refund",
  subjectId: "re_xyz789",
  status: "acknowledged",
  acknowledgedAt: "2026-10-09T09:10:00.000Z",
  acknowledgedBy: "user-1234-abcd",
};

const RESOLVED: ReconciliationFinding = {
  ...OPEN,
  id: "cccccccc-0000-4000-8000-000000000003",
  checkCode: "C7",
  summary: "Webhook processing anomaly",
  subjectType: "webhook_event",
  subjectId: "evt_987",
  status: "resolved",
  acknowledgedAt: "2026-10-09T09:10:00.000Z",
  acknowledgedBy: "user-1234-abcd",
  resolvedAt: "2026-10-09T09:20:00.000Z",
  resolvedBy: "user-5678-efgh",
  resolutionNote: "gateway settled",
};

const FINDINGS: ReconciliationFindingsResponse = {
  items: [OPEN, ACKED, RESOLVED],
  total: 3,
  counts: {
    byStatus: { open: 1, acknowledged: 1, resolved: 1 },
    bySeverity: { info: 0, warning: 3, critical: 0 },
  },
};

const RUNS = {
  items: [
    {
      id: "run-1",
      trigger: "manual",
      status: "success",
      startedAt: "2026-10-09T10:40:00.000Z",
      finishedAt: "2026-10-09T10:40:04.000Z",
      failedChecks: [],
      truncatedChecks: [],
      findingsOpen: 37,
      findingsNew: 1,
      findingsResolved: 0,
      error: null,
    },
  ],
};

let refetchFindingsMock: ReturnType<typeof vi.fn>;
let refetchRunsMock: ReturnType<typeof vi.fn>;

interface SetupOpts {
  findings?: ReconciliationFindingsResponse | null;
  runs?: typeof RUNS | null;
  error?: string | null;
  loading?: boolean;
}

function setupFetch(opts: SetupOpts = {}) {
  const { findings = FINDINGS, runs = RUNS, error = null, loading = false } = opts;
  useFetchMock.mockImplementation((url: string | null) => {
    if (typeof url === "string" && url.includes("/runs")) {
      return { data: runs, loading, error: null, refetch: refetchRunsMock };
    }
    return { data: findings, loading, error, refetch: refetchFindingsMock };
  });
}

function findingsUrls(): string[] {
  return useFetchMock.mock.calls
    .map((c) => c[0])
    .filter((u): u is string => typeof u === "string" && u.includes("/findings"));
}

function stat(label: string) {
  return screen.getAllByTestId("stat-card").find((c) => c.dataset.label === label);
}

function rowTriggerFor(finding: ReconciliationFinding) {
  return screen.getByLabelText(`Actions for finding ${finding.id.slice(0, 8)}`);
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  refetchFindingsMock = vi.fn();
  refetchRunsMock = vi.fn();
  setupFetch();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ReconciliationPage — rendering", () => {
  it("renders run strip, counts and findings table from the API", async () => {
    render(<ReconciliationPage />);

    expect(screen.getByText("Last reconciliation run")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("manual")).toBeInTheDocument();

    await waitFor(() => expect(stat("Total")).toHaveAttribute("data-value", "3"));
    expect(stat("Open")).toHaveAttribute("data-value", "1");
    expect(stat("Acknowledged")).toHaveAttribute("data-value", "1");
    expect(stat("Resolved")).toHaveAttribute("data-value", "1");
    expect(stat("Critical")).toHaveAttribute("data-value", "0");
    expect(stat("Warning")).toHaveAttribute("data-value", "3");

    expect(screen.getByText("Ledger payment mismatch")).toBeInTheDocument();
    expect(screen.getByText(/C5 · payment:pay_abc123/)).toBeInTheDocument();
    expect(screen.getAllByTestId("finding-row")).toHaveLength(3);
    expect(screen.getByText(/Showing 1–3 of 3/)).toBeInTheDocument();
  });

  it("shows the degradation notice with dash counts when counts are null, without disabling actions", async () => {
    setupFetch({
      findings: { items: [OPEN], total: null, counts: null },
    });
    render(<ReconciliationPage />);

    expect(await screen.findByText(/Counts unavailable/)).toBeInTheDocument();
    expect(
      screen.getAllByTestId("stat-card").every((c) => c.getAttribute("data-value") === "—")
    ).toBe(true);

    await userEvent.click(rowTriggerFor(OPEN));
    expect(await screen.findByRole("menuitem", { name: /Acknowledge/ })).toBeInTheDocument();
  });

  it("shows the loading skeleton while fetching without data", () => {
    setupFetch({ findings: null, loading: true });
    render(<ReconciliationPage />);
    expect(screen.getByTestId("findings-loading")).toBeInTheDocument();
  });

  it("shows an error state with a working Retry", async () => {
    setupFetch({ findings: null, error: "network down" });
    render(<ReconciliationPage />);

    expect(screen.getByText("Failed to load findings")).toBeInTheDocument();
    expect(screen.getByText("network down")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(refetchFindingsMock).toHaveBeenCalled();
  });

  it("shows the empty state when nothing matches", async () => {
    setupFetch({ findings: { items: [], total: 0, counts: { byStatus: { open: 0, acknowledged: 0, resolved: 0 }, bySeverity: { info: 0, warning: 0, critical: 0 } } } });
    render(<ReconciliationPage />);
    expect(await screen.findByText("No findings match the current filters.")).toBeInTheDocument();
  });
});

describe("ReconciliationPage — action menu matrix (hidden impossible actions)", () => {
  it("offers Acknowledge + Resolve only for open findings", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    expect(await screen.findByRole("menuitem", { name: /Acknowledge/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Resolve/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Reopen/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("offers Resolve only for acknowledged findings", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(ACKED));
    expect(await screen.findByRole("menuitem", { name: /Resolve/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Acknowledge/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Reopen/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("offers Reopen only for resolved findings", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(RESOLVED));
    expect(await screen.findByRole("menuitem", { name: /Reopen/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Acknowledge/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Resolve/ })).not.toBeInTheDocument();
  });
});

describe("ReconciliationPage — lifecycle mutations", () => {
  it("acknowledge: optional note, success toast, refetch, no changed-flag contract", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({ ok: true, status: 200, body: { ...ACKED } });
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    await user.click(await screen.findByRole("menuitem", { name: /Acknowledge/ }));

    const submit = screen.getByTestId("lifecycle-submit");
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() =>
      expect(reconPostMock).toHaveBeenCalledWith(
        `/api/admin/reconciliation/findings/${OPEN.id}/acknowledge`,
        {}
      )
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Finding acknowledged"));
    expect(refetchFindingsMock).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("resolve: requires a non-empty note before submitting", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    await user.click(await screen.findByRole("menuitem", { name: /Resolve/ }));

    const submit = screen.getByTestId("lifecycle-submit");
    expect(submit).toBeDisabled();

    const textarea = screen.getByLabelText("Resolve finding note");
    await user.type(textarea, "gateway settled by ops");
    expect(screen.getByTestId("note-counter")).toHaveTextContent("22/500");
    expect(submit).toBeEnabled();

    reconPostMock.mockResolvedValueOnce({ ok: true, status: 200, body: { ...RESOLVED } });
    await user.click(submit);

    await waitFor(() =>
      expect(reconPostMock).toHaveBeenCalledWith(
        `/api/admin/reconciliation/findings/${OPEN.id}/resolve`,
        { note: "gateway settled by ops" }
      )
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Finding resolved"));
    expect(refetchFindingsMock).toHaveBeenCalled();
  });

  it("reopen: optional note posts only when provided", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({ ok: true, status: 200, body: { ...OPEN } });
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(RESOLVED));
    await user.click(await screen.findByRole("menuitem", { name: /Reopen/ }));
    await user.click(screen.getByTestId("lifecycle-submit"));

    await waitFor(() =>
      expect(reconPostMock).toHaveBeenCalledWith(
        `/api/admin/reconciliation/findings/${RESOLVED.id}/reopen`,
        {}
      )
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Finding reopened"));
  });

  it("409 finding_state_conflict: warning toast with currentStatus, closes dialog, refetches before retry", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      body: { error: "finding_state_conflict", currentStatus: "resolved", finding: {} },
    });
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    await user.click(await screen.findByRole("menuitem", { name: /Resolve/ }));
    await user.type(screen.getByLabelText("Resolve finding note"), "note");
    await user.click(screen.getByTestId("lifecycle-submit"));

    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith(
        "Finding is already resolved",
        expect.anything()
      )
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refetchFindingsMock).toHaveBeenCalled();
  });

  it("404 finding_not_found: error toast, closes dialog, refetches", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      body: { error: "finding_not_found" },
    });
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    await user.click(await screen.findByRole("menuitem", { name: /Acknowledge/ }));
    await user.click(screen.getByTestId("lifecycle-submit"));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Finding not found", expect.anything()));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("400 invalid request: error toast keeps the dialog open for correction", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      body: { error: "invalid_note" },
    });
    render(<ReconciliationPage />);

    await user.click(rowTriggerFor(OPEN));
    await user.click(await screen.findByRole("menuitem", { name: /Resolve/ }));
    await user.type(screen.getByLabelText("Resolve finding note"), "note");
    await user.click(screen.getByTestId("lifecycle-submit"));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Invalid note", expect.anything()));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("ReconciliationPage — Run Now", () => {
  it("asks for confirmation, runs, toasts success and refreshes findings + runs", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        runId: "run-2",
        status: "success",
        trigger: "manual",
        checkResults: { C1: {}, C2: {} },
        findingsOpen: 37,
        findingsNew: 1,
        findingsResolved: 2,
        findingsReopened: 0,
        failedChecks: [],
        truncatedChecks: [],
        alerts: { recipients: 2 },
      },
    });
    render(<ReconciliationPage />);

    await user.click(screen.getByRole("button", { name: /Run Now/ }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Run now/ }));

    await waitFor(() =>
      expect(reconPostMock).toHaveBeenCalledWith("/api/admin/reconciliation/run")
    );
    await waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Reconciliation run complete", {
        description: expect.stringContaining("alerts to 2"),
      })
    );
    expect(refetchFindingsMock).toHaveBeenCalled();
    expect(refetchRunsMock).toHaveBeenCalled();
  });

  it("409 reconciliation_already_running: warns and refreshes run history only", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      body: { error: "reconciliation_already_running" },
    });
    render(<ReconciliationPage />);

    await user.click(screen.getByRole("button", { name: /Run Now/ }));
    await user.click(await screen.findByRole("button", { name: /Run now/ }));

    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith(
        "A reconciliation run is already in progress",
        expect.anything()
      )
    );
    expect(refetchRunsMock).toHaveBeenCalled();
    expect(refetchFindingsMock).not.toHaveBeenCalled();
  });

  it("429 rate limited: countdown comes from API retryAfterSeconds and disables the button", async () => {
    const user = userEvent.setup();
    reconPostMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      body: { error: "reconciliation_rate_limited", retryAfterSeconds: 45 },
    });
    render(<ReconciliationPage />);

    await user.click(screen.getByRole("button", { name: /Run Now/ }));
    await user.click(await screen.findByRole("button", { name: /Run now/ }));

    await waitFor(() =>
      expect(toastMock.warning).toHaveBeenCalledWith(
        "Manual runs are rate limited — retry in 45s"
      )
    );
    const disabled = await screen.findByRole("button", { name: /Wait 45s/ });
    expect(disabled).toBeDisabled();
    expect(refetchRunsMock).toHaveBeenCalled();
  });

  it("keeps findings browsing available while a run is pending", async () => {
    const user = userEvent.setup();
    let resolveRun: (v: unknown) => void = () => {};
    reconPostMock.mockReturnValueOnce(new Promise((r) => { resolveRun = r; }));
    render(<ReconciliationPage />);

    await user.click(screen.getByRole("button", { name: /Run Now/ }));
    await user.click(await screen.findByRole("button", { name: /Run now/ }));

    expect(await screen.findByRole("button", { name: /Running…/ })).toBeDisabled();
    expect(screen.getByText("Ledger payment mismatch")).toBeInTheDocument();
    expect(rowTriggerFor(OPEN)).toBeEnabled();

    await act(async () => {
      resolveRun({ ok: true, status: 200, body: { checkResults: {}, findingsOpen: 37, findingsNew: 0, findingsResolved: 0, findingsReopened: 0, failedChecks: [], truncatedChecks: [], status: "success", trigger: "manual", runId: "run-3", alerts: {} } });
    });
  });
});

describe("ReconciliationPage — filters and search", () => {
  it("wires the status filter into snake_case query params", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.click(screen.getByLabelText("Status filter"));
    await user.click(await screen.findByRole("option", { name: "Open" }));

    await waitFor(() => expect(findingsUrls().some((u) => u.includes("status=open"))).toBe(true));
    expect(findingsUrls().some((u) => u.includes("limit=50"))).toBe(true);
  });

  it("freezes requests and shows a hint for invalid search characters (no partial results)", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.type(screen.getByLabelText("Search findings"), "50%");
    expect(screen.getByRole("alert")).toHaveTextContent(/Search supports/);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(useFetchMock.mock.calls.some((c) => c[0] === null)).toBe(true);
    expect(findingsUrls().every((u) => !u.includes("q="))).toBe(true);
  });

  it("debounces valid search text into the q param", async () => {
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    await user.type(screen.getByLabelText("Search findings"), "pay_abc");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(findingsUrls().some((u) => u.includes("q=pay_abc"))).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ReconciliationPage — pagination", () => {
  it("pages with offset and reports the visible range", async () => {
    const allItems = Array.from({ length: 60 }, (_, i) => ({
      ...OPEN,
      id: `dddddddd-0000-4000-8000-${String(i).padStart(12, "0")}`,
      summary: `Wide finding ${i}`,
    }));
    useFetchMock.mockImplementation((url: string | null) => {
      if (typeof url === "string" && url.includes("/runs")) {
        return { data: RUNS, loading: false, error: null, refetch: refetchRunsMock };
      }
      const secondPage = typeof url === "string" && url.includes("offset=50");
      return {
        data: {
          items: secondPage ? allItems.slice(50) : allItems.slice(0, 50),
          total: 60,
          counts: FINDINGS.counts,
        },
        loading: false,
        error: null,
        refetch: refetchFindingsMock,
      };
    });
    const user = userEvent.setup();
    render(<ReconciliationPage />);

    expect(await screen.findByText(/Showing 1–50 of 60/)).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /Next/ });
    expect(next).toBeEnabled();

    await user.click(next);
    await waitFor(() => expect(findingsUrls().some((u) => u.includes("offset=50"))).toBe(true));
    expect(screen.getByText(/Showing 51–60 of 60/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled();
  });
});
