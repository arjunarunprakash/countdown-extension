import { useEffect, useRef, useState } from "preact/hooks";
import { dismissToast, toast, TOAST_MS } from "../state/toast";

/**
 * Bottom toast with an optional action ("Item removed · Undo").
 * Auto-dismisses after TOAST_MS; the timer pauses while hovered or focused
 * so people using a keyboard or screen reader have time to act.
 * Cmd/Ctrl+Z triggers the action while the toast is showing.
 */
export function Toast() {
  const t = toast.value;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(TOAST_MS);

  useEffect(() => {
    remaining.current = TOAST_MS;
    setPaused(false);
  }, [t?.id]);

  useEffect(() => {
    if (!t || paused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismissToast(t.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(1500, remaining.current - (Date.now() - started));
    };
  }, [t?.id, paused]);

  useEffect(() => {
    if (!t?.action) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable]")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        t.action!.run();
        dismissToast(t.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [t?.id]);

  return (
    <div class="toast-region" role="status" aria-live="polite">
      {t && (
        <div
          key={t.id}
          class="toast"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocusIn={() => setPaused(true)}
          onFocusOut={() => setPaused(false)}
        >
          <span class="toast__message">{t.message}</span>
          {t.action && (
            <button
              type="button"
              class="toast__action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
