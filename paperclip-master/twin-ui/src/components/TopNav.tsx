import { NavLink } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useLang } from '../context/LangContext';

interface TopNavProps {
  onRefetch?: () => void;
  isLoading?: boolean;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative px-4 py-2 text-xs font-semibold uppercase tracking-widest transition-colors rounded-md',
    isActive
      ? 'text-twin-accent bg-white/8 border border-twin-border-mid'
      : 'text-twin-text-3 hover:text-twin-text-2 hover:bg-white/5',
  ].join(' ');

export function TopNav({ onRefetch, isLoading }: TopNavProps) {
  const { lang, toggle, t } = useLang();

  const now = new Date().toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-twin-surface border-b border-twin-border">
      <div className="w-full px-5 sm:px-8 h-14 flex items-center gap-5">

        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0 me-2">
          <div className="w-8 h-8 rounded-lg bg-twin-accent flex items-center justify-center">
            <span className="text-xs font-black text-black select-none">و</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] text-twin-text-3 leading-none tracking-wider uppercase">
              {t('Ministry · Jordan', 'وزارة تطوير القطاع العام')}
            </p>
            <p className="text-xs font-bold text-twin-text leading-tight tracking-tight">
              {t('Ministerial Intelligence', 'الاستخبارات الوزارية')}
            </p>
          </div>
        </div>

        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">{t('Live', 'مباشر')}</span>
        </div>

        {/* Navigation tabs — center */}
        <nav className="flex items-center gap-1 mx-auto">
          <NavLink to="/attention" className={linkClass}>
            {t('Overview', 'النظرة العامة')}
          </NavLink>
          <NavLink to="/decisions" className={linkClass}>
            {t('Decisions', 'القرارات')}
          </NavLink>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden lg:block text-[10px] text-twin-text-3 tabular-nums">{now}</span>

          {onRefetch && (
            <button
              onClick={onRefetch}
              disabled={isLoading}
              title={t('Refresh', 'تحديث')}
              className="flex items-center gap-1.5 text-twin-text-3 hover:text-twin-text-2 transition-colors disabled:opacity-40 p-2 rounded-lg hover:bg-white/5"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-twin-border hover:border-twin-border-mid transition-colors"
          >
            {(['en', 'ar'] as const).map(l => (
              <span
                key={l}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                  lang === l ? 'bg-twin-accent text-black' : 'text-twin-text-3'
                }`}
              >
                {l.toUpperCase()}
              </span>
            ))}
          </button>
        </div>
      </div>
    </header>
  );
}
