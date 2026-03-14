"use client";

import type { RefObject } from "react";

export type KeyboardShortcutRow = {
  keys: string;
  action: string;
};

type KeyboardShortcutsHelpProps = {
  open: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcutRow[];
  dialogRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
};

export function KeyboardShortcutsHelp({
  open,
  onClose,
  shortcuts,
  dialogRef,
  closeButtonRef
}: KeyboardShortcutsHelpProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close keyboard shortcuts modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
      />
      <div
        id="keyboard-shortcuts-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        aria-describedby="keyboard-shortcuts-description"
        className="relative z-10 max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/80"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="keyboard-shortcuts-title" className="text-xl font-semibold text-slate-100">
              Keyboard shortcuts
            </h2>
            <p id="keyboard-shortcuts-description" className="mt-1 text-sm text-slate-300">
              Use these shortcuts to navigate and operate the checker faster.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs uppercase tracking-[0.12em] text-slate-200 transition hover:border-sky-500/60 hover:text-sky-200"
          >
            Close
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut.keys}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
            >
              <kbd className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-sky-200">
                {shortcut.keys}
              </kbd>
              <span className="text-sm text-slate-300">{shortcut.action}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">On macOS, Command (⌘) also works for Ctrl-based shortcuts.</p>
      </div>
    </div>
  );
}
