import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./globals.css";

// Self-heal: if a lazy chunk 404s because a new deploy replaced the files,
// reload once per session so the browser picks up fresh HTML + chunk names
// instead of showing "Failed to fetch dynamically imported module".
(() => {
  let reloaded = false;
  const isChunkFailure = (msg: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg || "");
  const reloadOnce = () => {
    if (reloaded) return;
    try {
      if (sessionStorage.getItem("lh_chunk_reload")) return;
      sessionStorage.setItem("lh_chunk_reload", "1");
    } catch {}
    reloaded = true;
    window.location.reload();
  };
  window.addEventListener("error", (e) => {
    const target = e.target as HTMLScriptElement | HTMLLinkElement | null;
    if (target && target.src && /\/assets\/.*\.js/.test(target.src)) {
      reloadOnce();
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    if (isChunkFailure(e.reason?.message || e.reason?.toString?.() || "")) {
      reloadOnce();
    }
  });
})();

const savedTheme = (() => {
  try { return localStorage.getItem("theme"); } catch { return null; }
})();
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
