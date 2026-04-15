import { createContext, useContext, useState, type ReactNode } from "react";

interface LangContextValue {
  lang: "en" | "ar";
  toggleLang: () => void;
  t: (en: string, ar: string) => string;
  isAr: boolean;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const toggleLang = () => setLang((l) => (l === "en" ? "ar" : "en"));
  const t = (en: string, ar: string) => (lang === "ar" ? ar : en);
  const isAr = lang === "ar";
  return (
    <LangContext.Provider value={{ lang, toggleLang, t, isAr }}>
      <div dir={isAr ? "rtl" : "ltr"} className={isAr ? "font-arabic" : ""}>
        {children}
      </div>
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be inside LangProvider");
  return ctx;
}
