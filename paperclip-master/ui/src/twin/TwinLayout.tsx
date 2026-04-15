import { Link, useLocation } from "@/lib/router";
import { Outlet } from "react-router-dom";
import {
  Briefcase, Radar, Zap, MessageSquare, Building2,
  FileText, Network, LayoutDashboard, GitBranch,
  PlayCircle, BookOpen, ArrowRight, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LangProvider, useLang } from "./LangContext";
import { CAPABILITIES } from "./config";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
};

const NAV_TOP = [
  { to: "/twin", label: "Dashboard", labelAr: "لوحة التحكم", icon: LayoutDashboard, exact: true },
];

const NAV_BOTTOM = [
  { to: "/twin/architecture", label: "Architecture", labelAr: "البنية المعمارية", icon: GitBranch },
  { to: "/twin/demo", label: "Demo Flow", labelAr: "تدفق العرض", icon: PlayCircle },
  { to: "/twin/summary", label: "Executive Summary", labelAr: "الملخص التنفيذي", icon: BookOpen },
  { to: "/twin/next-phase", label: "Next Phase", labelAr: "المرحلة التالية", icon: ArrowRight },
];

function NavItem({
  to, icon: Icon, label, labelAr, exact = false,
}: { to: string; icon: React.ElementType; label: string; labelAr: string; exact?: boolean }) {
  const location = useLocation();
  const { isAr } = useLang();
  const active = exact ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{isAr ? labelAr : label}</span>
    </Link>
  );
}

function TwinSidebar() {
  const { lang, toggleLang, isAr, t } = useLang();
  return (
    <aside className="w-60 h-full flex flex-col border-r border-border bg-background shrink-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <LayoutDashboard className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground truncate">
            {t("Minister Digital Twin", "التوأم الرقمي للوزير")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-8">
          {t("Jordan Vision 2030", "رؤية الأردن 2030")}
        </p>
      </div>

      {/* Top nav */}
      <div className="px-2 pt-3">
        {NAV_TOP.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>

      {/* Capabilities */}
      <div className="px-2 pt-4">
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          {t("Capabilities", "القدرات")}
        </p>
        <div className="space-y-0.5">
          {CAPABILITIES.map((cap) => {
            const Icon = iconMap[cap.icon] ?? FileText;
            return (
              <NavItem
                key={cap.key}
                to={`/twin/${cap.key}`}
                icon={Icon}
                label={cap.label}
                labelAr={cap.labelAr}
              />
            );
          })}
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <div className="px-2 pb-2">
        <div className="h-px bg-border mb-2" />
        {NAV_BOTTOM.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors w-full mt-0.5"
        >
          <Globe className="w-4 h-4 shrink-0" />
          <span>{lang === "en" ? "عربي" : "English"}</span>
        </button>
      </div>
    </aside>
  );
}

export function TwinLayout() {
  return (
    <LangProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <TwinSidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </LangProvider>
  );
}
