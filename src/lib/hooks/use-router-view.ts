import { useState, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export interface ViewQuery {
  filter?: string;
  stage?: string;
  delayed?: boolean;
  startDate?: string;
  endDate?: string;
  service?: string;
  status?: string;
}

type NavigateHandler = (view: string, opts?: ViewQuery) => void;

export function useRouterView(defaultView = "dashboard"): [string, React.Dispatch<React.SetStateAction<string>>, NavigateHandler, ViewQuery] {
  const { role } = useParams<{ role: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [view, setView] = useState(defaultView);

  // Sync view from URL on every location change (back/forward navigation)
  useLayoutEffect(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const viewFromUrl = segments.length >= 2 ? segments[segments.length - 1] : null;
    if (viewFromUrl && viewFromUrl !== role) {
      setView(viewFromUrl);
    }
  }, [location.pathname, role]);

  const query = useMemo<ViewQuery>(() => {
    const params = new URLSearchParams(location.search || "");
    return {
      filter: params.get("filter") ?? undefined,
      stage: params.get("stage") ?? undefined,
      delayed: params.get("delayed") === "true" ? true : undefined,
      startDate: params.get("startDate") ?? undefined,
      endDate: params.get("endDate") ?? undefined,
      service: params.get("service") ?? undefined,
      status: params.get("status") ?? undefined,
    };
  }, [location.search]);

  const handleNavigate = useCallback<NavigateHandler>((v, opts) => {
    setView(v);
    if (!role) return;
    const params = new URLSearchParams(location.search || "");
    params.delete("filter");
    params.delete("stage");
    params.delete("delayed");
    params.delete("startDate");
    params.delete("endDate");
    params.delete("service");
    params.delete("status");
    if (opts?.filter) params.set("filter", opts.filter);
    if (opts?.stage) params.set("stage", opts.stage);
    if (opts?.delayed) params.set("delayed", "true");
    if (opts?.startDate) params.set("startDate", opts.startDate);
    if (opts?.endDate) params.set("endDate", opts.endDate);
    if (opts?.service) params.set("service", opts.service);
    if (opts?.status) params.set("status", opts.status);
    const search = params.toString();
    navigate(`/${role}/${v}${search ? `?${search}` : ""}`, { replace: v === defaultView });
  }, [role, navigate, defaultView, location.search]);

  return [view, setView, handleNavigate, query];
}