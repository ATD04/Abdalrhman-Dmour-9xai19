// ─── Re-exports for backward compatibility ────────────────────────────────
// This file maintains backward compatibility while organizing components logically

// Base form components
export * from "./base";
export type { ButtonProps, InputProps, SelectProps, SelectOption } from "./base";

// Data display components
export * from "./data-display";
export type {
  StatCardProps,
  ConfidenceBadgeProps,
  StatusBadgeProps,
  MinistryTagProps,
  CitationChipProps,
  SourceCardProps,
} from "./data-display";

// Feedback & states
export * from "./feedback";
export type {
  AlertProps,
  LoadingSpinnerProps,
  EmptyStateProps,
  ModulePlaceholderProps,
  SkeletonLineProps,
  SkeletonGridProps,
} from "./feedback";

// Containers & layout
export * from "./containers";
export type {
  CardProps,
  PageHeaderProps,
  BreadcrumbItem,
  BreadcrumbProps,
  GridProps,
  StackProps,
} from "./containers";

// Service monitoring
export * from "./service";
export type { ServiceHealthIndicatorProps } from "./service";

// Toast notifications
export { ToastProvider, useToast } from "./toast";

// Re-export commonly used icons
export { AlertTriangle, CheckCircle, XCircle, Loader2, Search, FileText } from "lucide-react";
