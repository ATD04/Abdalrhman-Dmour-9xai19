"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextType {
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
  dismiss: () => {},
});

export const useToast = () => useContext(ToastContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = t.duration ?? 4000;

    setToasts((prev) => [...prev.slice(-4), { ...t, id }]); // max 5 visible

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
  }, [dismiss]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Toast Container ─────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle, color: "var(--teal-700)", bg: "var(--teal-50)", border: "var(--teal-100)" },
  error: { icon: XCircle, color: "var(--error-700)", bg: "var(--error-50)", border: "var(--error-100)" },
  warning: { icon: AlertTriangle, color: "var(--warning-700)", bg: "var(--warning-50)", border: "var(--warning-100)" },
  info: { icon: Info, color: "var(--info-700)", bg: "var(--info-50)", border: "var(--info-100)" },
};

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
      style={{ maxWidth: 400, minWidth: 320 }}
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const s = VARIANT_STYLES[t.variant];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto rounded-2xl border shadow-lg flex items-start gap-3 p-4"
              style={{ background: s.bg, borderColor: s.border, backdropFilter: "blur(8px)" }}
              role="alert"
            >
              <Icon size={18} style={{ color: s.color, flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: s.color }}>
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.85 }}>
                    {t.description}
                  </div>
                )}
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); onDismiss(t.id); }}
                    className="text-xs font-semibold mt-2 underline underline-offset-2 transition-opacity hover:opacity-75"
                    style={{ color: s.color }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className="flex-shrink-0 rounded-xl p-1 transition-opacity hover:opacity-60"
                style={{ color: s.color }}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
