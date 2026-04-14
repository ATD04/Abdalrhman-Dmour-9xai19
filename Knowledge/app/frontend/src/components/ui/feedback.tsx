"use client";

import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Loader2,
  Search,
} from "lucide-react";
import { motion } from "framer-motion";
import React from "react";
import { Button } from "./base";

// ─── Alert Component ──────────────────────────────────────────────────────

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
  onClose,
}: AlertProps) {
  const styles = {
    info: { bg: "var(--info-50)", border: "var(--info-100)", text: "var(--info-700)", icon: Info },
    success: { bg: "var(--teal-50)", border: "var(--success-100)", text: "var(--teal-700)", icon: CheckCircle },
    warning: { bg: "var(--warning-50)", border: "var(--warning-100)", text: "var(--warning-700)", icon: AlertTriangle },
    error: { bg: "var(--error-50)", border: "var(--error-100)", text: "var(--error-700)", icon: XCircle },
  };
  const s = styles[variant];
  const Icon = s.icon;

  return (
    <div
      className={cn("p-4 rounded-xl border flex items-start gap-3", className)}
      style={{ background: s.bg, borderColor: s.border }}
    >
      <Icon
        size={18}
        style={{ color: s.text, flexShrink: 0, marginTop: 1 }}
      />
      <div className="flex-1">
        {title && (
          <div
            className="font-semibold text-sm mb-0.5"
            style={{ color: s.text }}
          >
            {title}
          </div>
        )}
        <div className="text-sm" style={{ color: s.text }}>
          {children}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="hover:opacity-75 transition-opacity ml-2 flex-shrink-0"
          style={{ color: s.text }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── LoadingSpinner Component ─────────────────────────────────────────────

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
}

export function LoadingSpinner({
  size = "md",
  className,
  message,
}: LoadingSpinnerProps) {
  const sizes = { sm: 16, md: 24, lg: 32 };
  return (
    <div className="flex flex-col items-center gap-2">
      <Loader2
        size={sizes[size]}
        className={cn("animate-spin", className)}
        style={{ color: "var(--primary-700)" }}
      />
      {message && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
      )}
    </div>
  );
}

// ─── EmptyState Component ─────────────────────────────────────────────────

export interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {Icon && (
        <div
          className="w-14 h-14 rounded-3xl flex items-center justify-center mb-4"
          style={{
            background: "color-mix(in srgb, var(--teal-500) 6%, var(--bg-muted))",
            border: "1px solid color-mix(in srgb, var(--teal-500) 10%, transparent)",
          }}
        >
          <Icon size={24} style={{ color: "var(--text-muted)" }} />
        </div>
      )}
      <div className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
        {title}
      </div>
      {description && (
        <div
          className="text-sm max-w-xs"
          style={{ color: "var(--text-tertiary)" }}
        >
          {description}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── ModulePlaceholder Component ──────────────────────────────────────────

export interface ModulePlaceholderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
}

export function ModulePlaceholder({
  title,
  subtitle,
  icon: Icon,
  actions,
}: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-6"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 10%, transparent), color-mix(in srgb, var(--accent-gold) 5%, transparent))",
          border: "1px solid color-mix(in srgb, var(--accent-gold) 20%, transparent)",
          boxShadow: "0 10px 25px -5px color-mix(in srgb, var(--accent-gold) 10%, transparent)",
        }}
      >
        {Icon ? (
          <Icon size={32} style={{ color: "var(--accent-gold)" }} />
        ) : (
          <Search size={32} style={{ color: "var(--accent-gold)" }} />
        )}
      </motion.div>
      <h2
        className="text-2xl font-bold tracking-tight mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="text-sm max-w-md mx-auto leading-relaxed"
          style={{ color: "var(--text-tertiary)" }}
        >
          {subtitle}
        </p>
      )}
      {actions ? (
        <div className="mt-8">{actions}</div>
      ) : (
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" size="sm">
            Download Report
          </Button>
          <Button variant="primary" size="sm">
            Configure View
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── SkeletonLine Component ────────────────────────────────────────────────

export interface SkeletonLineProps {
  width?: string;
  height?: number;
}

export function SkeletonLine({ width = "100%", height = 14 }: SkeletonLineProps) {
  return <div className="skeleton rounded" style={{ width, height }} />;
}

// ─── SkeletonCard Component ───────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-surface)",
      }}
    >
      <SkeletonLine width="60%" height={12} />
      <SkeletonLine height={24} />
      <SkeletonLine width="40%" height={10} />
    </div>
  );
}

// ─── Multiple SkeletonCard variant ────────────────────────────────────────

export interface SkeletonGridProps {
  count?: number;
  columns?: number;
}

export function SkeletonGrid({ count = 6, columns = 3 }: SkeletonGridProps) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${100 / columns}%, 1fr))`,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
