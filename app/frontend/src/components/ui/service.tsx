"use client";

import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

// ─── ServiceHealthIndicator Component ─────────────────────────────────────

export interface ServiceHealthIndicatorProps {
  services: Record<string, boolean>;
  isAr?: boolean;
}

export function ServiceHealthIndicator({
  services,
  isAr = false,
}: ServiceHealthIndicatorProps) {
  const allHealthy = Object.values(services).every((v) => v);
  const serviceNames: Record<string, { en: string; ar: string }> = {
    agent: { en: "Agent", ar: "الوكيل" },
    knowledge: { en: "Knowledge", ar: "المعرفة" },
    governance: { en: "Governance", ar: "الحوكمة" },
    workflow: { en: "Workflow", ar: "سير العمل" },
  };

  return (
    <div className="flex items-center gap-3">
      {Object.entries(services).map(([key, healthy]) => (
        <div
          key={key}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium"
          style={{
            borderRadius: 9999,
            background: healthy ? "var(--teal-50)" : "var(--error-50)",
            color: healthy ? "var(--teal-700)" : "var(--error-700)",
          }}
        >
          {healthy ? (
            <CheckCircle size={12} />
          ) : (
            <XCircle size={12} />
          )}
          {isAr ? serviceNames[key]?.ar : serviceNames[key]?.en}
        </div>
      ))}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold"
        style={{
          borderRadius: 9999,
          background: allHealthy ? "var(--teal-50)" : "var(--warning-50)",
          color: allHealthy ? "var(--teal-700)" : "var(--warning-700)",
        }}
      >
        {allHealthy ? (
          <>
            <CheckCircle size={12} />
            {isAr ? "كل الخدمات" : "All Services"}
          </>
        ) : (
          <>
            <AlertTriangle size={12} />
            {isAr ? "خدمات متأثرة" : "Degraded"}
          </>
        )}
      </div>
    </div>
  );
}
