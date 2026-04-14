"use client";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppShell";
import { History as HistoryIcon } from "lucide-react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
  const { lang } = useApp();
  const router = useRouter();
  const isAr = lang === "ar";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/");
    }, 250);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <AppShell title={isAr ? "سجل المحادثات" : "Conversation History"}>
      <div className="page-container" style={{ maxWidth: 700 }}>
        <div className="surface-card" style={{ padding: 44, textAlign: "center", background: "var(--bg-card)", border: "1px solid var(--border-light)" }}>
          <div style={{ width: 54, height: 54, borderRadius: "var(--radius-xl)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
            <HistoryIcon size={24} style={{ color: "var(--text-secondary)" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            {isAr ? "تم نقل السجل" : "History moved"}
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 22 }}>
            {isAr ? "سجل المحادثات متاح الآن في الشريط الجانبي داخل صفحة المساعد." : "Conversation history now lives in the assistant sidebar."}
          </p>
          <Link href="/" className="btn btn-primary">
            {isAr ? "العودة إلى المساعد" : "Back to Assistant"}
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
