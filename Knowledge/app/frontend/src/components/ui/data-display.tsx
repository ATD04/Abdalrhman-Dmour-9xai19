"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import React from "react";

// ─── StatCard Component ───────────────────────────────────────────────────

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ElementType;
  iconColor?: string;
  accent?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "var(--teal-600)",
  className,
}: StatCardProps) {
  const positive = (change ?? 0) > 0;
  const neutral = change === 0 || change === undefined;

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "var(--shadow-card-hover)" }}
      transition={{ duration: 0.18 }}
      className={cn("stat-card", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className="text-xs font-semibold tracking-wide uppercase mb-3"
            style={{ color: "var(--text-muted)", letterSpacing: "0.06em" }}
          >
            {title}
          </div>
          <div
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </div>
          {change !== undefined && (
            <div
              className="flex items-center gap-1 mt-2 text-xs font-medium"
              style={{
                color: neutral ? "var(--gray-medium)" : positive ? "var(--success)" : "var(--error)",
              }}
            >
              {neutral ? (
                <Minus size={11} />
              ) : positive ? (
                <TrendingUp size={11} />
              ) : (
                <TrendingDown size={11} />
              )}
              {change !== undefined && !neutral && `${positive ? "+" : ""}${change}%`}
              {changeLabel && (
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                  {changeLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `color-mix(in srgb, ${iconColor} 10%, var(--bg-muted))`,
              border: `1px solid color-mix(in srgb, ${iconColor} 15%, transparent)`,
            }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── ConfidenceBadge Component ────────────────────────────────────────────

export interface ConfidenceBadgeProps {
  value: number; // 0-1
  showBar?: boolean;
  size?: "sm" | "md";
  label?: string;
}

export function ConfidenceBadge({
  value,
  showBar = false,
  size = "md",
  label,
}: ConfidenceBadgeProps) {
  const pct = Math.round(value * 100);
  const level = value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low";
  const colors = {
    high: {
      text: "var(--teal-700)",
      bg: "var(--teal-50)",
      bar: "var(--success-700)",
      label: label || "High",
    },
    medium: {
      text: "var(--warning-700)",
      bg: "var(--warning-50)",
      bar: "var(--warning-700)",
      label: label || "Medium",
    },
    low: {
      text: "var(--error-700)",
      bg: "var(--error-50)",
      bar: "var(--error-700)",
      label: label || "Low",
    },
  };
  const c = colors[level];

  return (
    <div className={cn("flex items-center gap-2", size === "sm" && "text-xs")}>
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: c.bg, color: c.text }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: c.text }}
        ></span>
        {c.label} · {pct}%
      </span>
      {showBar && (
        <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--stone-soft)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: c.bar }}
          />
        </div>
      )}
    </div>
  );
}

// ─── StatusBadge Component ────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "var(--info-700)", bg: "var(--info-50)" },
  in_review: { label: "In Review", color: "var(--warning-700)", bg: "var(--warning-50)" },
  resolved: { label: "Resolved", color: "var(--teal-700)", bg: "var(--teal-50)" },
  pending: { label: "Pending", color: "var(--gray-500)", bg: "var(--gray-100)" },
  published: { label: "Published", color: "var(--teal-700)", bg: "var(--teal-50)" },
  processing: { label: "Processing", color: "var(--warning-700)", bg: "var(--warning-50)" },
  archived: { label: "Archived", color: "var(--gray-500)", bg: "var(--gray-100)" },
  active: { label: "Active", color: "var(--teal-700)", bg: "var(--teal-50)" },
  inactive: { label: "Inactive", color: "var(--gray-500)", bg: "var(--gray-100)" },
  critical: { label: "Critical", color: "var(--error-700)", bg: "var(--error-50)" },
  high: { label: "High", color: "var(--warning-700)", bg: "var(--warning-50)" },
  medium: { label: "Medium", color: "var(--info-700)", bg: "var(--info-50)" },
  low: { label: "Low", color: "var(--teal-700)", bg: "var(--teal-50)" },
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "md" }: StatusBadgeProps) {
  const s = STATUS_MAP[status] ?? {
    label: status,
    color: "var(--gray-500)",
    bg: "var(--gray-100)",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
        size === "sm" && "px-1.5 py-0.25 text-xs",
        className
      )}
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: s.color }}
      ></span>
      {s.label}
    </span>
  );
}

// ─── MinistryTag Component ────────────────────────────────────────────────

export interface MinistryTagProps {
  name: string;
  className?: string;
}

export function MinistryTag({ name, className }: MinistryTagProps) {
  const short = name.replace("Ministry of ", "").replace("Ministry ", "");
  return (
    <span className={cn("ministry-tag", className)} title={name}>
      {short.length > 28 ? short.slice(0, 26) + "…" : short}
    </span>
  );
}

// ─── CitationChip Component ───────────────────────────────────────────────

export interface CitationChipProps {
  id: string | number;
  title?: string;
  page?: number;
  onClick?: () => void;
}

export function CitationChip({ id, title, page, onClick }: CitationChipProps) {
  return (
    <button
      onClick={onClick}
      className="citation-chip"
      title={title ? `${title}${page ? ` — Page ${page}` : ""}` : undefined}
    >
      [{id}]
    </button>
  );
}

// ─── SourceCard Component ─────────────────────────────────────────────────

export interface SourceCardProps {
  id: string | number;
  title: string;
  ministry: string;
  page?: number;
  relevance?: number;
  excerpt?: string;
  onClick?: () => void;
}

export function SourceCard({
  id,
  title,
  ministry,
  page,
  relevance,
  excerpt,
  onClick,
}: SourceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-4 cursor-pointer transition-colors"
      style={{
        borderColor: "var(--border-subtle)",
        background: "var(--bg-surface)",
      }}
      whileHover={{ background: "var(--bg-subtle)" }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-sm mb-1 leading-snug"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </div>
          <MinistryTag name={ministry} />
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--teal-600)" }}>
            [{id}]
          </div>
          {page && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              p. {page}
            </div>
          )}
        </div>
      </div>
      {excerpt && (
        <p
          className="text-xs leading-relaxed mt-2 pt-2 border-t italic"
          style={{
            color: "var(--text-tertiary)",
            borderColor: "var(--border-subtle)",
          }}
        >
          &quot;{excerpt}&quot;
        </p>
      )}
      {relevance !== undefined && (
        <div
          className="flex items-center gap-2 mt-2 pt-2 border-t"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Relevance
          </span>
          <div
            className="flex-1 h-1 rounded-full"
            style={{ background: "var(--stone-soft)", maxWidth: 80 }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(relevance * 100)}%`,
                background: "var(--teal-500)",
              }}
            />
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: "var(--teal-600)" }}
          >
            {Math.round(relevance * 100)}%
          </span>
        </div>
      )}
    </motion.div>
  );
}
