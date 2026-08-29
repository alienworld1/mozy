"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function CandidateReplacementDialog({
  currentHash,
  onKeep,
  onReplace,
}: {
  currentHash: string;
  onKeep: () => void;
  onReplace: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    const focusable = node?.querySelectorAll<HTMLElement>("button");
    focusable?.[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onKeep();
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [onKeep]);
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-3 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onKeep();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replacement-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-control border border-line-strong bg-paper-raised p-5 shadow-control"
      >
        <p className="font-mono text-[10px] tracking-wide text-ink-tertiary">
          REPLACE CANDIDATE
        </p>
        <h2 id="replacement-title" className="mt-2 text-xl font-medium">
          Use a different transaction?
        </h2>
        <p className="mt-4 text-sm leading-6 text-ink-secondary">
          The app will supersede{" "}
          <span className="font-mono" title={currentHash}>
            {currentHash.slice(0, 10)}…{currentHash.slice(-8)}
          </span>{" "}
          in this workspace. The old foreign transaction remains on-chain.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onKeep}
            className="min-h-11 rounded-control border border-line-strong px-4 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-signal"
          >
            Keep current transaction
          </button>
          <button
            type="button"
            onClick={onReplace}
            className="min-h-11 rounded-control bg-signal px-4 text-sm font-medium text-paper-raised outline-none hover:bg-signal-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            Use replacement
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
