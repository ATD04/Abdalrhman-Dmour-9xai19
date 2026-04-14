"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, LayoutDashboard,
  BarChart3, BookOpen, ChevronLeft, ChevronRight,
  Globe, Ticket, Upload,
  ScrollText, LogOut, Moon, Sun, Trash2
} from "lucide-react";
import { loadStoredSession, saveStoredSession, clearStoredSession } from "@/lib/user-context";
import { normalizeOwnerId } from "@/lib/user-context";
import { clearAuthCookie, setAuthCookie } from "@/lib/auth-cookie";
import {
  CHAT_ACTIVE_CONVERSATION_EVENT,
  CHAT_HISTORY_UPDATED_EVENT,
  ChatConversationRecord,
  getActiveConversationId as persistGetActiveConversationId,
  loadConversations,
  setActiveConversationId as persistActiveConversationId,
  deleteConversation as persistDeleteConversation,
} from "@/lib/chat-history";

// ─── Context ────────────────────────────────────────────────────────────────

type RoleType = "citizen" | "operator" | "admin";
type ThemeMode = "light" | "dark";

interface AppContextType {
  role: RoleType;
  setRole: (r: RoleType) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  userEmail: string;
  setUserEmail: (e: string) => void;
  lang: "en" | "ar";
  setLang: (l: "en" | "ar") => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (t: ThemeMode) => void;
  toggleThemeMode: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType>({
  role: "citizen", setRole: () => {},
  isLoggedIn: false, setIsLoggedIn: () => {},
  userEmail: "", setUserEmail: () => {},
  lang: "en", setLang: () => {},
  sidebarCollapsed: false, setSidebarCollapsed: () => {},
  themeMode: "light", setThemeMode: () => {},
  toggleThemeMode: () => {},
  logout: () => {},
});

export const useApp = () => useContext(AppContext);

// ─── Nav config ─────────────────────────────────────────────────────────────

type NavItem = { href: string; icon: React.ElementType; label: string; labelAr: string };
type NavGroup = { section?: string; sectionAr?: string; items: NavItem[] };

const NAV_CONFIG: Record<RoleType, NavGroup[]> = {
  citizen: [
    { items: [
      { href: "/", icon: MessageSquare, label: "AI Assistant", labelAr: "المساعد الذكي" },
    ]},
  ],
  operator: [
    { items: [
      { href: "/expert", icon: LayoutDashboard, label: "Dashboard", labelAr: "لوحة التحكم" },
      { href: "/expert/tickets", icon: Ticket, label: "Case Management", labelAr: "إدارة الحالات" },
      { href: "/expert/history", icon: ScrollText, label: "History", labelAr: "السجل" },
      { href: "/knowledge", icon: BookOpen, label: "Knowledge Hub", labelAr: "مركز المعرفة" },
      { href: "/knowledge/upload", icon: Upload, label: "Content Management", labelAr: "إدارة المحتوى" },
    ]},
    { section: "General", sectionAr: "عام", items: [
      { href: "/", icon: MessageSquare, label: "AI Assistant", labelAr: "المساعد" },
    ]},
  ],
  admin: [
    { items: [
      { href: "/admin", icon: LayoutDashboard, label: "Control Tower", labelAr: "برج المراقبة" },
      { href: "/executive", icon: BarChart3, label: "Executive Overview", labelAr: "النظرة التنفيذية" },
      { href: "/executive/analytics", icon: BarChart3, label: "Executive Analytics", labelAr: "التحليلات التنفيذية" },
      { href: "/admin/users", icon: ScrollText, label: "User Management", labelAr: "إدارة المستخدمين" },
      { href: "/knowledge", icon: BookOpen, label: "Knowledge Hub", labelAr: "مركز المعرفة" },
      { href: "/expert", icon: Ticket, label: "Case Operations", labelAr: "عمليات الحالات" },
    ]},
    { section: "General", sectionAr: "عام", items: [
      { href: "/", icon: MessageSquare, label: "AI Assistant", labelAr: "المساعد" },
    ]},
  ],
};

const ROLE_META: Record<RoleType, { label: string; labelAr: string; color: string; bg: string; avatarGradient: string }> = {
  citizen:  { label: "Citizen",   labelAr: "مواطن",   color: "var(--text-inverse)", bg: "var(--primary-700)", avatarGradient: "linear-gradient(135deg, var(--primary-700), var(--primary-900))" },
  operator: { label: "Operator",  labelAr: "مشغل",   color: "var(--text-inverse)", bg: "var(--teal-700)", avatarGradient: "linear-gradient(135deg, var(--teal-600), var(--primary-800))" },
  admin:    { label: "Admin",     labelAr: "مشرف",   color: "var(--text-inverse)", bg: "var(--accent-gold-dark)", avatarGradient: "linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))" },
};

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar() {
  const { role, lang, sidebarCollapsed, setSidebarCollapsed, isLoggedIn, userEmail } = useApp();
  const pathname = usePathname();
  const isAr = lang === "ar";
  const ownerId = normalizeOwnerId(isLoggedIn, userEmail);
  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [activeConversationId, setActiveConversation] = useState<string | null>(null);

  const nav: NavGroup[] = isLoggedIn
    ? (NAV_CONFIG[role] || NAV_CONFIG.citizen)
    : [{ items: [{ href: "/", icon: MessageSquare, label: "AI Assistant", labelAr: "المساعد الذكي" }] }];

  useEffect(() => {
    if (role !== "citizen" && role !== "admin") return;

    const refreshConversations = () => {
      setConversations(loadConversations(ownerId).slice(0, 10));
      setActiveConversation(persistGetActiveConversationId(ownerId));
    };

    const onHistoryUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ ownerId?: string }>;
      if (customEvent.detail?.ownerId && customEvent.detail.ownerId !== ownerId) return;
      refreshConversations();
    };

    const onActiveConversationUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ ownerId?: string; conversationId?: string }>;
      if (customEvent.detail?.ownerId && customEvent.detail.ownerId !== ownerId) return;
      setActiveConversation(customEvent.detail?.conversationId || persistGetActiveConversationId(ownerId));
    };

    refreshConversations();

    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, onHistoryUpdated as EventListener);
    window.addEventListener(CHAT_ACTIVE_CONVERSATION_EVENT, onActiveConversationUpdated as EventListener);
    window.addEventListener("storage", refreshConversations);

    return () => {
      window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, onHistoryUpdated as EventListener);
      window.removeEventListener(CHAT_ACTIVE_CONVERSATION_EVENT, onActiveConversationUpdated as EventListener);
      window.removeEventListener("storage", refreshConversations);
    };
  }, [ownerId, role]);

  const openConversation = (conversationId: string) => {
    persistActiveConversationId(ownerId, conversationId);
    setActiveConversation(conversationId);
  };

  const formatConversationDate = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(isAr ? "ar-JO" : "en-US", {
      month: "short",
      day: "2-digit",
    });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar flex-shrink-0 h-screen flex flex-col overflow-hidden"
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-3 px-5 h-16 border-b transition-colors"
        style={{ borderColor: "var(--border-light)" }}
      >
        <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/shahem-logo.png" alt="Shahem logo" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = "/shahem-logo.svg"; }} />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="font-bold text-[15px] tracking-wide" style={{ color: "var(--text-primary)" }}>{isAr ? "شهم" : "Shahem"}</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Intelligence Platform</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Link>

      {/* Role badge */}
      <AnimatePresence>
        {isLoggedIn && !sidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mx-4 mt-4 p-3 rounded-2xl"
            style={{ background: "var(--bg-accent)", border: "1px solid var(--border-light)" }}
          >
            <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
              {isAr ? "الدور" : "Role"}
            </div>
            <div
              className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block"
              style={{ backgroundColor: ROLE_META[role].bg, color: ROLE_META[role].color }}
            >
              {isAr ? ROLE_META[role].labelAr : ROLE_META[role].label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {nav.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : ""}>
            {group.section && !sidebarCollapsed && (
              <div className="px-4 mb-2 text-[10px] font-semibold tracking-widest uppercase" style={{ color: "var(--text-muted)" }}>
                {isAr ? group.sectionAr : group.section}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item relative ${active ? "active" : ""}`}
                    title={sidebarCollapsed ? (isAr ? item.labelAr : item.label) : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="truncate">
                        {isAr ? item.labelAr : item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {(role === "citizen" || role === "admin") && !sidebarCollapsed && (
          <div className="mt-6 px-2">
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
              <ScrollText size={12} />
              {isAr ? "المحادثات الأخيرة" : "Recent Chats"}
            </div>

            <div className="space-y-1">
              {conversations.length === 0 ? (
                <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {isAr ? "لا توجد محادثات بعد" : "No conversation history yet"}
                </div>
              ) : (
                conversations.map((conversation) => {
                  const conversationActive = activeConversationId === conversation.id;
                  return (
                    <div key={conversation.id} className="group relative">
                      <Link
                        href="/"
                        onClick={() => openConversation(conversation.id)}
                        className={`sidebar-item ${conversationActive ? "active" : ""}`}
                        style={{ minHeight: 44, paddingTop: 8, paddingBottom: 8 }}
                        title={conversation.title}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-medium group-hover:pr-6" style={{ color: "var(--text-primary)" }}>
                            {conversation.title || (isAr ? "محادثة جديدة" : "New Chat")}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {formatConversationDate(conversation.updatedAt)}
                          </div>
                        </div>
                      </Link>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (window.confirm(isAr ? "هل أنت متأكد من حذف هذه المحادثة؟" : "Are you sure you want to delete this conversation?")) {
                            persistDeleteConversation(ownerId, conversation.id);
                          }
                        }}
                        className={`absolute ${isAr ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10`}
                        style={{ color: "var(--text-muted)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error-500)"; e.currentTarget.style.background = "var(--error-50)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                        title={isAr ? "حذف" : "Delete"}
                      >
                        <Trash2 size={14} />
                      </button>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Utility actions + collapse toggle */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: "var(--border-light)" }}>
        {role === "citizen" && isLoggedIn && (
          <Link
            href="/my-tickets"
            className={`sidebar-item relative ${pathname === "/my-tickets" ? "active" : ""}`}
            title={sidebarCollapsed ? (isAr ? "طلباتي" : "My Requests") : undefined}
          >
            <Ticket size={18} className="flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{isAr ? "طلباتي" : "My Requests"}</span>}
          </Link>
        )}

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-medium transition-all"
          style={{ color: "var(--text-muted)", background: "var(--bg-accent)", border: "1px solid var(--border-light)" }}
          aria-label={sidebarCollapsed ? (isAr ? "توسيع الشريط الجانبي" : "Expand sidebar") : (isAr ? "طي الشريط الجانبي" : "Collapse sidebar")}
          aria-expanded={!sidebarCollapsed}
          type="button"
        >
          {sidebarCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>{isAr ? "طي" : "Collapse"}</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

// ─── Topbar ──────────────────────────────────────────────────────────────────

function Topbar({ title }: { title?: string }) {
  const { role, isLoggedIn, logout, lang, setLang, userEmail, themeMode, toggleThemeMode } = useApp();
  const pathname = usePathname();
  const isAr = lang === "ar";

  const displayName = userEmail
    ? userEmail.split("@")[0].charAt(0).toUpperCase() + userEmail.split("@")[0].slice(1)
    : "Guest";
  const initials = userEmail
    ? userEmail.split("@")[0].slice(0, 2).toUpperCase()
    : "G";

  return (
    <header className="topbar app-topbar">
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="topbar-title font-semibold text-base truncate" style={{ color: "var(--text-primary)" }}>{title}</h1>
        )}
      </div>

      {/* Theme Toggle */}
      <button
        onClick={toggleThemeMode}
        className="topbar-theme-btn"
        aria-label={themeMode === "dark" ? (isAr ? "تبديل إلى الوضع الفاتح" : "Switch to light mode") : (isAr ? "تبديل إلى الوضع الداكن" : "Switch to dark mode")}
        aria-pressed={themeMode === "dark"}
        title={themeMode === "dark" ? (isAr ? "الوضع الفاتح" : "Light mode") : (isAr ? "الوضع الداكن" : "Dark mode")}
        type="button"
      >
        {themeMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Language Toggle */}
      <button
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        className="topbar-lang-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition-all"
        style={{ border: "1px solid var(--border-light)", color: "var(--text-muted)", background: "transparent" }}
        aria-label={isAr ? "تبديل إلى الإنجليزية" : "Switch to Arabic"}
        type="button"
      >
        <Globe size={16} />
        {lang === "en" ? "العربية" : "English"}
      </button>

      {/* User Section */}
      {!isLoggedIn ? (
        pathname !== "/login" && (
          <Link href="/login">
            <button className="btn btn-primary btn-md">
              {isAr ? "تسجيل الدخول" : "Sign In"}
            </button>
          </Link>
        )
      ) : (
        <div className="topbar-user-section flex items-center gap-4 pl-4 ml-2" style={{ borderLeft: "1px solid var(--border-light)" }}>
          <div className={`text-${isAr ? 'left' : 'right'}`}>
            <div className="topbar-user-name text-sm font-medium" style={{ color: "var(--text-primary)" }}>{displayName}</div>
            <button
              onClick={logout}
              className="topbar-logout text-xs font-medium flex items-center gap-1 transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--error-500)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <LogOut size={11} />
              {isAr ? "خروج" : "Logout"}
            </button>
          </div>
          <div
            className="topbar-avatar w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-md"
            style={{ background: ROLE_META[role].avatarGradient }}
          >
            {initials}
          </div>
        </div>
      )}
    </header>
  );
}

// ─── AppProvider ─────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [bootSession] = useState(() => loadStoredSession());
  const [role, setRole] = useState<RoleType>(bootSession?.role ?? "citizen");
  const [isLoggedIn, setIsLoggedIn] = useState(bootSession?.isLoggedIn ?? false);
  const [userEmail, setUserEmail] = useState(bootSession?.userEmail ?? "");
  const [lang, setLang] = useState<"en" | "ar">(bootSession?.lang ?? "en");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(bootSession?.sidebarCollapsed ?? false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(bootSession?.themeMode ?? "light");

  useEffect(() => {
    saveStoredSession({ role, isLoggedIn, userEmail, lang, sidebarCollapsed, themeMode });
    // Sync cookie with localStorage session
    if (isLoggedIn && userEmail) {
      setAuthCookie({ email: userEmail, role, isLoggedIn: true });
    }
  }, [role, isLoggedIn, userEmail, lang, sidebarCollapsed, themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    document.body.classList.toggle("mono-theme", themeMode === "dark");
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUserEmail("");
    setRole("citizen");
    clearAuthCookie();
    clearStoredSession();
  };

  return (
    <AppContext.Provider value={{ role, setRole, isLoggedIn, setIsLoggedIn, userEmail, setUserEmail, lang, setLang, sidebarCollapsed, setSidebarCollapsed, themeMode, setThemeMode, toggleThemeMode, logout }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { lang, themeMode } = useApp();

  return (
    <div className={`app-shell app-shell-mono flex h-screen overflow-hidden ${themeMode === "dark" ? "app-shell-dark-chat" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"} style={{ background: "var(--bg-subtle)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative">
        <div className="app-atmosphere" aria-hidden="true" />
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto relative z-[1]">
          {children}
        </main>
      </div>
    </div>
  );
}
