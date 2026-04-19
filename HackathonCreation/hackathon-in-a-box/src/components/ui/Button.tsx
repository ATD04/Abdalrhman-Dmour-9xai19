import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "premium";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseVariant = "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background active:scale-95 transition-spring";
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-indigo-700 shadow-sm",
      premium: "bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-600 hover:to-violet-600 shadow-md shadow-indigo-200 border border-indigo-400",
      destructive: "bg-destructive text-destructive-foreground hover:bg-red-600",
      outline: "border border-input bg-transparent hover:bg-slate-50 text-slate-700",
      secondary: "bg-secondary text-secondary-foreground hover:bg-slate-300",
      ghost: "hover:bg-slate-100 text-slate-700",
    };
    
    const sizes = {
      default: "h-11 py-2 px-6",
      sm: "h-9 px-4 rounded-md",
      lg: "h-14 px-8 rounded-xl text-base",
      icon: "h-10 w-10",
    };

    return (
      <button
        ref={ref}
        className={cn(baseVariant, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
