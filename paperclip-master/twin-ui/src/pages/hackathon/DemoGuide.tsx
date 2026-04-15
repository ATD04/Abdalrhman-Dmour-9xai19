import { useLang } from '../../context/LangContext';

const DEMO_FLOW = [
  {
    step: 1, emoji: '🌐',
    titleEn: 'Open the Minister Platform',
    titleAr: 'افتح منصة الوزير',
    bodyEn: 'Navigate to http://localhost:3200 — the system auto-redirects to the "Attention Now" page.',
    bodyAr: 'انتقل إلى http://localhost:3200 — يُعيد النظام تلقائياً إلى صفحة "اهتمامات الآن".',
  },
  {
    step: 2, emoji: '📋',
    titleEn: 'Page 1 — Attention Now',
    titleAr: 'الصفحة 1 — اهتمامات الآن',
    bodyEn: 'Show: Morning Brief (CoS output), Today\'s Priorities (Radar), Needs Intervention (critical items), Public Pulse (Voice), Service Pain Points (Friction), Coordination Alerts (Coordination).',
    bodyAr: 'اعرض: الإحاطة الصباحية، الأولويات، ما يحتاج تدخلاً، نبض المواطنين، نقاط ألم الخدمات، تنبيهات التنسيق.',
  },
  {
    step: 3, emoji: '🔄',
    titleEn: 'Toggle Arabic / English',
    titleAr: 'تبديل العربية والإنجليزية',
    bodyEn: 'Click the EN/AR toggle top-right. The entire UI switches to Arabic with RTL layout — demonstrating bilingual capability.',
    bodyAr: 'انقر على مبدِّل EN/AR — تتحول الواجهة بأكملها إلى العربية مع التخطيط من اليمين لليسار.',
  },
  {
    step: 4, emoji: '✅',
    titleEn: 'Page 2 — Decisions & Follow-Up',
    titleAr: 'الصفحة 2 — القرارات والمتابعة',
    bodyEn: 'Switch to the "Decisions" tab. Show: Decisions Required (Policy), Policy Insights, Readiness Snapshot, Follow-Up Tracker (CoS), Weekly Reform Movement (all 7 modules), Escalations.',
    bodyAr: 'انتقل إلى تبويب "القرارات". اعرض: القرارات المطلوبة، رؤى السياسات، لقطة الجاهزية، متابعة الالتزامات، حركة الإصلاح الأسبوعية، التصعيد.',
  },
  {
    step: 5, emoji: '🔗',
    titleEn: 'Hackathon Assets',
    titleAr: 'أصول الهاكاثون',
    bodyEn: 'Click "Assets" (top-right) to access Architecture view, Demo Guide, Executive Summary, and Next Phase roadmap — for judges.',
    bodyAr: 'انقر "الأصول" للوصول إلى البنية ودليل العرض والملخص التنفيذي وخارطة الطريق — للمحكمين.',
  },
  {
    step: 6, emoji: '💡',
    titleEn: 'Key Talking Points',
    titleAr: 'النقاط الرئيسية',
    bodyEn: 'One connected system. 7 AI capabilities. Each card is a real Paperclip issue updated by AI agents. The minister only sees outputs — never internal machinery.',
    bodyAr: 'نظام واحد متصل. 7 قدرات ذكاء اصطناعي. كل بطاقة مهمة Paperclip حقيقية تُحدَّث بالوكلاء. الوزير يرى المخرجات فقط، لا الآليات الداخلية.',
  },
];

export function DemoGuide() {
  const { t, isAr } = useLang();
  return (
    <div className="py-6">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-twin-accent mb-1">{t('Presentation Guide', 'دليل العرض')}</p>
      <h2 className="text-xl font-bold text-slate-100 mb-1">{t('Demo Walkthrough', 'جولة العرض التجريبي')}</h2>
      <p className="text-sm text-slate-500 mb-6">{t('Step-by-step guide for hackathon judges and stakeholders.', 'دليل خطوة بخطوة للمحكمين وأصحاب المصلحة.')}</p>

      <div className="relative">
        <div className="absolute start-8 top-10 bottom-10 w-px bg-gradient-to-b from-twin-accent/40 via-twin-border to-transparent" />
        <div className="space-y-4">
          {DEMO_FLOW.map(step => (
            <div key={step.step} className="relative flex gap-5">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-16 h-14 bg-twin-card border border-twin-border rounded-xl flex flex-col items-center justify-center z-10">
                  <span className="text-xl">{step.emoji}</span>
                  <span className="text-[10px] text-slate-600 font-bold">{step.step}</span>
                </div>
              </div>
              <div className="flex-1 bg-twin-card border border-twin-border rounded-xl p-4">
                <p className="text-sm font-bold text-slate-100 mb-1">{isAr ? step.titleAr : step.titleEn}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{isAr ? step.bodyAr : step.bodyEn}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 bg-twin-accent/5 border border-twin-accent/20 rounded-xl">
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="font-semibold text-twin-accent">{t('Setup: ', 'الإعداد: ')}</span>
          {t(
            'Paperclip backend must be running on port 3100. Twin UI runs on port 3200. Start with: cd twin-ui && npm run dev',
            'يجب أن تعمل الواجهة الخلفية على المنفذ 3100. واجهة التوأم على 3200. ابدأ بـ: cd twin-ui && npm run dev',
          )}
        </p>
      </div>
    </div>
  );
}
