import { Outlet, NavLink } from 'react-router-dom';
import { useLang } from '../../context/LangContext';

const HACK_NAV = [
  { to: 'architecture', labelEn: 'Architecture',      labelAr: 'البنية'          },
  { to: 'demo',         labelEn: 'Demo Guide',         labelAr: 'دليل العرض'      },
  { to: 'summary',      labelEn: 'Exec. Summary',      labelAr: 'الملخص التنفيذي' },
  { to: 'roadmap',      labelEn: 'Next Phase',         labelAr: 'المرحلة القادمة' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${isActive ? 'bg-twin-accent/15 text-twin-accent' : 'text-slate-500 hover:text-slate-300'}`;

export function HackathonShell() {
  const { t } = useLang();
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6">
      <div className="mt-4 mb-0 flex items-center gap-2 p-1 bg-twin-card border border-twin-border rounded-xl w-fit">
        <span className="text-[10px] text-slate-600 font-semibold px-2">
          {t('Hackathon Assets', 'أصول الهاكاثون')}
        </span>
        {HACK_NAV.map(n => (
          <NavLink key={n.to} to={n.to} className={linkClass}>
            {t(n.labelEn, n.labelAr)}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
