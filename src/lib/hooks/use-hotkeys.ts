import { useEffect } from "react";

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

export function useHotkeys(keymap: KeyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const key = [
        e.metaKey ? "Cmd" : "",
        e.ctrlKey ? "Ctrl" : "",
        e.shiftKey ? "Shift" : "",
        e.altKey ? "Alt" : "",
        e.key,
      ]
        .filter(Boolean)
        .join("+");

      const combo = keymap[key];
      if (combo) {
        e.preventDefault();
        combo(e);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keymap, enabled]);
}
