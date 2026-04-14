"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, EmptyState, Button } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Star, Trash2, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listSavedAnswers, removeSavedAnswer, SavedAnswer } from "@/lib/saved-answers";
import { normalizeOwnerId } from "@/lib/user-context";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SavedPage() {
  const { lang, isLoggedIn, userEmail } = useApp();
  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);
  const [items, setItems] = useState<SavedAnswer[]>([]);

  const refresh = () => setItems(listSavedAnswers(ownerId));

  useEffect(() => {
    refresh();
  }, [ownerId]);

  const onRemove = (id: string) => {
    removeSavedAnswer(ownerId, id);
    refresh();
  };

  return (
    <ProtectedRoute allowed={["citizen", "admin"]} requireAuth>
    <AppShell title={isAr ? "الإجابات المحفوظة" : "Saved Answers"}>
      <div className="page-container" style={{ maxWidth: 1080 }}>
        <PageHeader
          title={isAr ? "الإجابات المحفوظة" : "Saved Answers"}
          subtitle={isAr ? "مرجعك السريع لأهم إجابات شهم." : "Your quick reference for important Shahem responses."}
        />

        <div className="hero-banner mb-6">
          <div className="hero-banner-content">
            <div className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: "var(--accent-gold)" }}>
              {isAr ? "مكتبة شخصية" : "Personal Knowledge Vault"}
            </div>
            <div className="remaster-page-title text-white mb-2">
              {isAr ? "إجاباتك المحفوظة في مكان واحد" : "Your Saved Answers in One Place"}
            </div>
            <div className="text-sm max-w-3xl" style={{ color: "var(--text-inverse)", opacity: 0.8 }}>
              {isAr ? "احتفظ بالإجابات المهمة وارجع إليها بسرعة أثناء العمل أو المتابعة مع الفريق." : "Keep your most useful responses ready for quick recall and follow-up."}
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Star}
            title={isAr ? "لا توجد إجابات محفوظة" : "No saved answers yet"}
            description={isAr ? "احفظ أي إجابة من شاشة المحادثة للوصول إليها هنا." : "Save any response from chat and it will appear here."}
            action={<Link href="/"><Button size="sm">{isAr ? "اذهب إلى المحادثة" : "Go to Chat"}</Button></Link>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {items.map((item) => (
              <div key={item.id} className="surface-card-hover p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{new Date(item.createdAt).toLocaleString(isAr ? "ar-JO" : "en-US")}</div>
                    <h3 className="font-semibold text-sm mb-2" style={{ color: "var(--text-primary)" }}>{item.question || (isAr ? "سؤال بدون عنوان" : "Untitled question")}</h3>
                    <p className="text-sm leading-6 whitespace-pre-wrap line-clamp-5" style={{ color: "var(--text-secondary)" }}>{item.answer}</p>
                    {item.citations && item.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.citations.slice(0, 4).map((c, idx) => (
                          <span key={`${c.source_id}-${c.page}-${idx}`} className="text-[11px] px-2 py-1 rounded" style={{ background: "var(--bg-accent)", color: "var(--text-secondary)" }}>
                            {c.source_name} · p.{c.page}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href="/">
                      <button className="p-2 rounded border" style={{ borderColor: "var(--border)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"} onMouseLeave={e => e.currentTarget.style.background = ""} title={isAr ? "فتح في المحادثة" : "Open in chat"}>
                        <ExternalLink size={14} />
                      </button>
                    </Link>
                    <button onClick={() => onRemove(item.id)} className="p-2 rounded border" style={{ borderColor: "color-mix(in srgb, var(--error-500) 20%, transparent)", color: "var(--error-600)" }} onMouseEnter={e => e.currentTarget.style.background = "color-mix(in srgb, var(--error-500) 5%, transparent)"} onMouseLeave={e => e.currentTarget.style.background = ""} title={isAr ? "حذف" : "Delete"}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
