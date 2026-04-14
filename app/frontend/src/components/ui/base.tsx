"use client";

import React, { forwardRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Button Component ─────────────────────────────────────────────────────

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ElementType;
  iconRight?: React.ElementType;
  isLoading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: IconLeft,
  iconRight: IconRight,
  isLoading = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);

  const styles = {
    primary: { background: "var(--primary-800)", color: "var(--text-inverse)", border: "1px solid var(--primary-800)" },
    secondary: { background: "var(--bg-muted)", color: "var(--text-primary)", border: "1px solid var(--border-light)" },
    ghost: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
    danger: { background: "var(--error-50)", color: "var(--error-500)", border: "1px solid var(--error-100)" },
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm", lg: "px-5 py-2.5 text-sm" };

  const getBoxShadow = () => {
    if (variant === "primary" && hovered && !disabled && !isLoading) {
      return "var(--shadow-md), 0 4px 14px color-mix(in srgb, var(--teal-500) 15%, transparent)";
    }
    if (variant === "danger" && hovered && !disabled && !isLoading) {
      return "0 4px 14px color-mix(in srgb, var(--error-500) 20%, transparent)";
    }
    if (variant === "primary") {
      return "var(--shadow-sm)";
    }
    return undefined;
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      onMouseEnter={(e) => { setHovered(true); props.onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); props.onMouseLeave?.(e); }}
      className={cn(
        "inline-flex items-center gap-2 font-medium rounded-xl transition-all duration-150",
        !disabled && !isLoading && "cursor-pointer hover:opacity-90",
        disabled && "opacity-50 cursor-not-allowed",
        sizes[size],
        className
      )}
      style={{
        ...styles[variant],
        boxShadow: getBoxShadow(),
      }}
    >
      {IconLeft && !isLoading && <IconLeft size={size === "sm" ? 12 : 14} />}
      {isLoading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
      {IconRight && !isLoading && <IconRight size={size === "sm" ? 12 : 14} />}
    </button>
  );
}

// ─── Input Component ──────────────────────────────────────────────────────

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ElementType;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, helperText, className, ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
            {props.required && <span aria-label="required"> *</span>}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--gray-400)" }}
              aria-hidden="true"
            />
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all",
              "focus:ring-2 focus:ring-teal-500/15 focus:border-teal-600",
              Icon ? "pl-10" : "",
              error ? "border-error-500 focus:ring-error-500/20" : "border-gray-200",
              className
            )}
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              boxShadow: focused ? "inset 0 1px 4px rgba(0,0,0,0.06)" : undefined,
            }}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-required={props.required}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs flex items-center gap-1" style={{ color: "var(--error-500)" }} role="alert">
            <AlertTriangle size={12} aria-hidden="true" /> {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs" style={{ color: "var(--text-muted)" }}>{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// ─── Select Component ─────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, helperText, className, ...props }, ref) => {
    const selectId = props.id || `select-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${selectId}-error` : undefined;
    const helperId = helperText && !error ? `${selectId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
            {props.required && <span aria-label="required"> *</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all appearance-none cursor-pointer",
            "focus:ring-2 focus:ring-teal-500/15 focus:border-teal-600",
            error ? "border-error-500 focus:ring-error-500/20" : "border-gray-200",
            className
          )}
          style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          aria-required={props.required}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-xs flex items-center gap-1" style={{ color: "var(--error-500)" }} role="alert">
            <AlertTriangle size={12} aria-hidden="true" /> {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs" style={{ color: "var(--text-muted)" }}>{helperText}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
