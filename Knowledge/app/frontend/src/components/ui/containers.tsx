"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React from "react";

// ─── Card Component ───────────────────────────────────────────────────────

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  border?: boolean;
}

export function Card({
  children,
  className,
  hover = false,
  padding = "md",
  border = true,
}: CardProps) {
  const Wrapper = hover ? motion.div : "div";
  const hoverProps = hover
    ? {
        whileHover: {
          y: -2,
          boxShadow: "var(--shadow-card-hover)",
          borderColor: "var(--border-medium)",
        },
      }
    : {};

  const paddingSizes = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <Wrapper
      className={cn(
        "rounded-2xl",
        border && "border",
        hover && "cursor-pointer",
        paddingSizes[padding],
        className
      )}
      style={{
        background: "var(--bg-card)",
        borderColor: border ? "var(--border-light)" : undefined,
        boxShadow: "var(--shadow-card)",
        transition: "all 220ms ease",
      }}
      {...hoverProps}
    >
      {children}
    </Wrapper>
  );
}

// ─── PageHeader Component ─────────────────────────────────────────────────

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ElementType;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon: Icon,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "color-mix(in srgb, var(--teal-500) 8%, var(--bg-muted))",
              border: "1px solid color-mix(in srgb, var(--teal-500) 12%, transparent)",
            }}
          >
            <Icon size={20} style={{ color: "var(--teal-600)" }} />
          </div>
        )}
        <div>
          <h1
            className="text-xl font-bold leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ─── Breadcrumb Component ─────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  className?: string;
}

export function Breadcrumb({
  items,
  separator = "/",
  className,
}: BreadcrumbProps) {
  return (
    <nav
      className={cn("flex items-center gap-2 text-sm mb-4", className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span style={{ color: "var(--text-muted)" }}>{separator}</span>
          )}
          {item.href ? (
            <a
              href={item.href}
              className="hover:underline transition-colors"
              style={{ color: "var(--teal-700)" }}
            >
              {item.label}
            </a>
          ) : (
            <button
              onClick={item.onClick}
              className="hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: "var(--teal-700)" }}
              disabled={!item.onClick && !item.href}
            >
              {item.label}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}

// ─── Grid Container Component ─────────────────────────────────────────────

export interface GridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6;
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Grid({
  children,
  columns = 3,
  gap = "md",
  className,
}: GridProps) {
  const gapSizes = {
    xs: "gap-2",
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  };

  return (
    <div
      className={cn(
        `grid`,
        `grid-cols-${columns}`,
        `md:grid-cols-${Math.max(1, Math.floor(columns / 2))}`,
        `sm:grid-cols-1`,
        gapSizes[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Stack Component ──────────────────────────────────────────────────────

export interface StackProps {
  children: React.ReactNode;
  direction?: "row" | "column";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end";
  justify?: "start" | "center" | "end" | "between" | "around";
  className?: string;
}

export function Stack({
  children,
  direction = "column",
  gap = "md",
  align = "start",
  justify = "start",
  className,
}: StackProps) {
  const gapSizes = {
    xs: "gap-2",
    sm: "gap-3",
    md: "gap-4",
    lg: "gap-6",
    xl: "gap-8",
  };

  const directions = {
    row: "flex-row",
    column: "flex-col",
  };

  const aligns = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
  };

  const justifies = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };

  return (
    <div
      className={cn(
        "flex",
        directions[direction],
        gapSizes[gap],
        aligns[align],
        justifies[justify],
        className
      )}
    >
      {children}
    </div>
  );
}
