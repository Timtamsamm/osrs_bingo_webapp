"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Themed replacement for window.confirm().
 *
 *   if (!(await confirmDialog({ title: "Delete team?", message: "…", danger: true }))) return;
 *
 * <ConfirmDialogHost /> is mounted once in the root layout and renders
 * whichever dialog is currently open. Escape or clicking the backdrop
 * cancels. Destructive (danger) dialogs focus Cancel by default, so a
 * stray Enter can't delete anything.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, Cancel focused by default. */
  danger?: boolean;
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let current: Pending | null = null;
const listeners = new Set<() => void>();

function publish(next: Pending | null) {
  current = next;
  for (const l of listeners) l();
}

// useSyncExternalStore reads `current` directly, so a dialog opened before
// the host mounted (e.g. from another component's mount effect) still shows.
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => current;
const getServerSnapshot = () => null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // A dialog opened while another is showing cancels the first.
    current?.resolve(false);
    publish({ ...options, resolve });
  });
}

export default function ConfirmDialogHost() {
  const pending = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function close(ok: boolean) {
    pending?.resolve(ok);
    publish(null);
  }

  useEffect(() => {
    if (!pending) return;
    (pending.danger ? cancelRef : confirmRef).current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // close() only reads `pending`, which is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[page-fade-in_120ms_ease-out]"
      onMouseDown={(e) => e.target === e.currentTarget && close(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={pending.message ? "confirm-dialog-message" : undefined}
        className="w-full max-w-sm bg-[#0e0820] border border-purple-800/60 rounded-2xl shadow-2xl shadow-black/60 p-5 purple-glow-sm"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={`mt-0.5 w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
              pending.danger ? "bg-red-500/15 text-red-300 border border-red-500/40" : "bg-purple-600/20 text-purple-200 border border-purple-500/40"
            }`}
          >
            {pending.danger ? "!" : "?"}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="font-semibold text-white">
              {pending.title}
            </h2>
            {pending.message && (
              <p id="confirm-dialog-message" className="mt-1.5 text-sm text-purple-300/90 whitespace-pre-line leading-relaxed">
                {pending.message}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-purple-200 border border-purple-800/60 hover:border-purple-600/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 ${
              pending.danger ? "bg-red-600 hover:bg-red-500 focus:ring-red-400/50" : "bg-purple-700 hover:bg-purple-600 focus:ring-purple-400/50"
            }`}
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
