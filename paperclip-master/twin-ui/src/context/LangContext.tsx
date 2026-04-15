import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Lang = 'en' | 'ar';

const STORAGE_KEY = 'twin-lang';

function applyLang(lang: Lang) {
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

interface LangCtx {
  lang: Lang;
  toggle: () => void;
  t: (en: string, ar: string) => string;
  isAr: boolean;
}

const LangContext = createContext<LangCtx>({
  lang: 'ar',
  toggle: () => {},
  t: (_en, ar) => ar,
  isAr: true,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    // Default to Arabic; only switch to English if user explicitly chose it
    return stored === 'en' ? 'en' : 'ar';
  });

  // Apply dir/lang attribute on mount and whenever lang changes
  useEffect(() => {
    applyLang(lang);
  }, [lang]);

  const toggle = () => {
    setLang(prev => {
      const next: Lang = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const t = (en: string, ar: string) => (lang === 'ar' ? ar : en);

  return (
    <LangContext.Provider value={{ lang, toggle, t, isAr: lang === 'ar' }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
