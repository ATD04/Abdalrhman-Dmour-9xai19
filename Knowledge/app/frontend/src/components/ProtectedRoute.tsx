"use client";

import { useApp } from "@/components/AppShell";
import { getAuthCookieClient } from "@/lib/auth-cookie";
import type { AppRole } from "@/lib/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProtectedRouteProps {
  allowed: AppRole[];
  requireAuth?: boolean;
  children: React.ReactNode;
}

export function ProtectedRoute({
  allowed,
  requireAuth = true,
  children,
}: ProtectedRouteProps) {
  const { role, isLoggedIn, logout, lang } = useApp();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">(
    "checking"
  );
  const isAr = lang === "ar";

  useEffect(() => {
    // Check cookie expiry
    if (isLoggedIn) {
      const cookie = getAuthCookieClient();
      if (!cookie) {
        logout();
        router.replace("/login");
        return;
      }
    }

    if (requireAuth && !isLoggedIn) {
      router.replace("/login");
      return;
    }

    if (isLoggedIn && !allowed.includes(role)) {
      setStatus("denied");
      return;
    }

    setStatus("allowed");
  }, [role, isLoggedIn, allowed, requireAuth, router, logout]);

  if (status === "checking") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "50vh",
          color: "var(--text-muted)",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: "3px solid var(--border-light)",
            borderTop: "3px solid var(--primary-700)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          gap: 16,
          color: "var(--text-primary)",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--error-500) 12%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          🚫
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          {isAr ? "غير مصرح بالوصول" : "Access Denied"}
        </h2>
        <p style={{ color: "var(--text-muted)", margin: 0, maxWidth: 400 }}>
          {isAr
            ? "ليس لديك صلاحية للوصول إلى هذه الصفحة. يرجى التواصل مع المسؤول إذا كنت تعتقد أن هذا خطأ."
            : "You don't have permission to access this page. Contact your administrator if you believe this is an error."}
        </p>
        <button
          onClick={() => router.push("/")}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            background: "var(--primary-700)",
            color: "var(--text-inverse)",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {isAr ? "العودة للرئيسية" : "Go to Home"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
