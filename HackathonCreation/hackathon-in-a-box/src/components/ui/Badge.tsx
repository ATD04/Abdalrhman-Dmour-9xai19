import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "premium" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-primary/10 text-primary hover:bg-primary/20",
    premium: "border-transparent bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-800",
    success: "border-transparent bg-emerald-100 text-emerald-800",
    secondary: "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200",
    destructive: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
    outline: "text-foreground",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
