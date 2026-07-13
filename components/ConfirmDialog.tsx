"use client";

import { useEffect, useRef } from "react";
import Button from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Danger variant styles the confirm button red — useful for destructive actions. */
  danger?: boolean;
}

/**
 * In-app confirmation modal matching the poker night dark/gold aesthetic.
 * Replaces window.confirm() with something branded.
 *
 * - Enter confirms, Escape cancels
 * - Clicking the backdrop cancels
 * - Focuses the confirm button on open so Enter works immediately
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", handleKey);
    // Autofocus confirm so Enter works right away
    setTimeout(() => confirmBtnRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gold-500/60 bg-felt-800 shadow-2xl p-5 sm:p-6"
        style={{
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.6), 0 0 24px rgba(212, 167, 44, 0.18)",
        }}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg sm:text-xl font-bold text-white mb-2 leading-snug"
        >
          {title}
        </h2>
        {message && (
          <p className="text-white/70 text-sm mb-5">{message}</p>
        )}
        {!message && <div className="h-4" />}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
