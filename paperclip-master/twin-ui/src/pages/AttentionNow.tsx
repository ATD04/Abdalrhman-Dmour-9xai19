import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardPanel } from '../components/DashboardPanel';
import { ExecListItem } from '../components/ExecCard';
import { SeverityChip, priorityToSeverity } from '../components/SeverityChip';
import { useLang } from '../context/LangContext';
import { useAutoTranslate } from '../hooks/useAutoTranslate';
import type { Issue, IssuePriority } from '../types';

const MEETING_RE = /(meeting|sync|جلسة|اجتماع|لجنة|ورشة|conference|جلسات)/i;
const MONITOR_RE = /(monitor|watch|risk|escalat|follow.?up|راقب|متابعة|تصعيد|مخاطر)/i;

type OfficeAgendaSlot = {
  startHour: number;
  endHour: number;
  subjectEn: string;
  subjectAr: string;
  laneEn: string;
  laneAr: string;
  colorClass: string;
};

const OFFICE_WEEK_PLAN: Array<{
  themeEn: string;
  themeAr: string;
  slots: OfficeAgendaSlot[];
}> = [
  {
    themeEn: 'Education and Skills Delivery Day',
    themeAr: 'يوم تنفيذ التعليم والمهارات',
    slots: [
      {
        startHour: 9,
        endHour: 10,
        subjectEn: 'School Readiness Brief',
        subjectAr: 'إحاطة جاهزية المدارس',
        laneEn: 'Chief of Staff Office',
        laneAr: 'مكتب الديوان',
        colorClass: 'bg-blue-600',
      },
      {
        startHour: 11,
        endHour: 12,
        subjectEn: 'Teacher Hiring Bottlenecks',
        subjectAr: 'اختناقات تعيين المعلمين',
        laneEn: 'Education Operations',
        laneAr: 'عمليات التعليم',
        colorClass: 'bg-indigo-500',
      },
      {
        startHour: 14,
        endHour: 16,
        subjectEn: 'Vocational Program Steering',
        subjectAr: 'توجيه برامج التدريب المهني',
        laneEn: 'Policy Delivery Team',
        laneAr: 'فريق تنفيذ السياسات',
        colorClass: 'bg-cyan-600',
      },
      {
        startHour: 17,
        endHour: 18,
        subjectEn: 'Citizen Education Complaints Triage',
        subjectAr: 'فرز شكاوى التعليم للمواطنين',
        laneEn: 'Public Voice Unit',
        laneAr: 'وحدة صوت المواطن',
        colorClass: 'bg-amber-500',
      },
    ],
  },
  {
    themeEn: 'Health Access and Hospital Flow Day',
    themeAr: 'يوم الوصول الصحي وتدفق المستشفيات',
    slots: [
      {
        startHour: 9,
        endHour: 10,
        subjectEn: 'Emergency Room Throughput Review',
        subjectAr: 'مراجعة تدفق أقسام الطوارئ',
        laneEn: 'Service Performance Cell',
        laneAr: 'خلية أداء الخدمات',
        colorClass: 'bg-rose-500',
      },
      {
        startHour: 11,
        endHour: 13,
        subjectEn: 'Drug Supply Escalation Board',
        subjectAr: 'مجلس تصعيد إمداد الدواء',
        laneEn: 'Risk Radar',
        laneAr: 'رادار المخاطر',
        colorClass: 'bg-red-600',
      },
      {
        startHour: 15,
        endHour: 16,
        subjectEn: 'Hospital Capacity Coordination',
        subjectAr: 'تنسيق الطاقة الاستيعابية للمستشفيات',
        laneEn: 'Coordination Unit',
        laneAr: 'وحدة التنسيق',
        colorClass: 'bg-violet-600',
      },
      {
        startHour: 17,
        endHour: 18,
        subjectEn: 'Patient Experience Follow-up',
        subjectAr: 'متابعة تجربة المرضى',
        laneEn: 'Public Voice Unit',
        laneAr: 'وحدة صوت المواطن',
        colorClass: 'bg-emerald-600',
      },
    ],
  },
  {
    themeEn: 'Transport and Licensing Operations Day',
    themeAr: 'يوم عمليات النقل والتراخيص',
    slots: [
      {
        startHour: 10,
        endHour: 11,
        subjectEn: 'Public Transport Reliability Standup',
        subjectAr: 'اجتماع موثوقية النقل العام',
        laneEn: 'Transport Operations',
        laneAr: 'عمليات النقل',
        colorClass: 'bg-sky-600',
      },
      {
        startHour: 13,
        endHour: 14,
        subjectEn: 'Driver Licensing Backlog Review',
        subjectAr: 'مراجعة تراكم رخص القيادة',
        laneEn: 'Service Performance Cell',
        laneAr: 'خلية أداء الخدمات',
        colorClass: 'bg-orange-500',
      },
      {
        startHour: 15,
        endHour: 17,
        subjectEn: 'Traffic Incident Coordination',
        subjectAr: 'تنسيق حوادث المرور',
        laneEn: 'Coordination Unit',
        laneAr: 'وحدة التنسيق',
        colorClass: 'bg-fuchsia-600',
      },
      {
        startHour: 18,
        endHour: 19,
        subjectEn: 'Mobility KPI Snapshot',
        subjectAr: 'لقطة مؤشرات التنقل',
        laneEn: 'Decision Support Office',
        laneAr: 'مكتب دعم القرار',
        colorClass: 'bg-teal-600',
      },
    ],
  },
  {
    themeEn: 'Municipal Services and Utilities Day',
    themeAr: 'يوم الخدمات البلدية والمرافق',
    slots: [
      {
        startHour: 9,
        endHour: 10,
        subjectEn: 'Water Supply Continuity Review',
        subjectAr: 'مراجعة استمرارية إمداد المياه',
        laneEn: 'Utilities Desk',
        laneAr: 'مكتب المرافق',
        colorClass: 'bg-cyan-700',
      },
      {
        startHour: 11,
        endHour: 12,
        subjectEn: 'Waste Collection SLA Check',
        subjectAr: 'فحص مستوى خدمة جمع النفايات',
        laneEn: 'Municipal Services',
        laneAr: 'الخدمات البلدية',
        colorClass: 'bg-lime-600',
      },
      {
        startHour: 14,
        endHour: 16,
        subjectEn: 'Smart City Projects Review',
        subjectAr: 'مراجعة مشاريع المدن الذكية',
        laneEn: 'Digital Transformation PMO',
        laneAr: 'مكتب إدارة التحول الرقمي',
        colorClass: 'bg-violet-500',
      },
      {
        startHour: 17,
        endHour: 18,
        subjectEn: 'Mayor Escalations Roundtable',
        subjectAr: 'طاولة تصعيدات البلديات',
        laneEn: 'Governorates Desk',
        laneAr: 'مكتب المحافظات',
        colorClass: 'bg-amber-600',
      },
    ],
  },
  {
    themeEn: 'Cabinet Readiness and Budget Control Day',
    themeAr: 'يوم جاهزية مجلس الوزراء وضبط الميزانية',
    slots: [
      {
        startHour: 10,
        endHour: 11,
        subjectEn: 'Cabinet Decision Readiness Check',
        subjectAr: 'فحص جاهزية قرارات مجلس الوزراء',
        laneEn: 'Decision Support Office',
        laneAr: 'مكتب دعم القرار',
        colorClass: 'bg-zinc-500',
      },
      {
        startHour: 12,
        endHour: 14,
        subjectEn: 'Budget Variance Committee',
        subjectAr: 'لجنة انحرافات الميزانية',
        laneEn: 'Finance and Governance',
        laneAr: 'المالية والحوكمة',
        colorClass: 'bg-red-500',
      },
      {
        startHour: 15,
        endHour: 16,
        subjectEn: 'High-Risk Procurement Cases',
        subjectAr: 'حالات المشتريات عالية المخاطر',
        laneEn: 'Risk Radar',
        laneAr: 'رادار المخاطر',
        colorClass: 'bg-orange-600',
      },
      {
        startHour: 17,
        endHour: 18,
        subjectEn: 'Ministerial Notes for Cabinet',
        subjectAr: 'ملاحظات الوزير لمجلس الوزراء',
        laneEn: 'Chief of Staff Office',
        laneAr: 'مكتب الديوان',
        colorClass: 'bg-indigo-600',
      },
    ],
  },
  {
    themeEn: 'Field Feedback and Inspections Day',
    themeAr: 'يوم التغذية الميدانية والجولات التفتيشية',
    slots: [
      {
        startHour: 9,
        endHour: 11,
        subjectEn: 'Inspection Mission Kickoff',
        subjectAr: 'انطلاق مهمات التفتيش',
        laneEn: 'Governorates Desk',
        laneAr: 'مكتب المحافظات',
        colorClass: 'bg-emerald-500',
      },
      {
        startHour: 12,
        endHour: 13,
        subjectEn: 'Rural Access Service Review',
        subjectAr: 'مراجعة وصول الخدمات للمناطق الريفية',
        laneEn: 'Service Performance Cell',
        laneAr: 'خلية أداء الخدمات',
        colorClass: 'bg-sky-500',
      },
      {
        startHour: 14,
        endHour: 15,
        subjectEn: 'Escalation Calls with Regions',
        subjectAr: 'اتصالات التصعيد مع المناطق',
        laneEn: 'Coordination Unit',
        laneAr: 'وحدة التنسيق',
        colorClass: 'bg-fuchsia-500',
      },
      {
        startHour: 16,
        endHour: 17,
        subjectEn: 'Inspection Findings Debrief',
        subjectAr: 'مناقشة نتائج الجولات التفتيشية',
        laneEn: 'Policy Delivery Team',
        laneAr: 'فريق تنفيذ السياسات',
        colorClass: 'bg-yellow-600',
      },
    ],
  },
  {
    themeEn: 'Weekly Planning and Team Capacity Day',
    themeAr: 'يوم التخطيط الأسبوعي وطاقة الفرق',
    slots: [
      {
        startHour: 10,
        endHour: 11,
        subjectEn: 'Cross-Unit Weekly Planning',
        subjectAr: 'تخطيط أسبوعي بين الوحدات',
        laneEn: 'Coordination Unit',
        laneAr: 'وحدة التنسيق',
        colorClass: 'bg-sky-700',
      },
      {
        startHour: 13,
        endHour: 15,
        subjectEn: 'Backlog Prioritization Session',
        subjectAr: 'جلسة ترتيب أولويات التراكم',
        laneEn: 'Chief of Staff Office',
        laneAr: 'مكتب الديوان',
        colorClass: 'bg-purple-600',
      },
      {
        startHour: 16,
        endHour: 17,
        subjectEn: 'Delivery Capacity Review',
        subjectAr: 'مراجعة طاقة التنفيذ',
        laneEn: 'Policy Delivery Team',
        laneAr: 'فريق تنفيذ السياسات',
        colorClass: 'bg-teal-500',
      },
      {
        startHour: 17,
        endHour: 18,
        subjectEn: 'Next Week Minister Brief Draft',
        subjectAr: 'مسودة إحاطة الوزير للأسبوع القادم',
        laneEn: 'Decision Support Office',
        laneAr: 'مكتب دعم القرار',
        colorClass: 'bg-amber-600',
      },
    ],
  },
];

const P_MAP: Record<IssuePriority, [string, string]> = {
  critical: ['Critical', 'حرجي'],
  high: ['High', 'مرتفع'],
  medium: ['Monitor', 'متابعة'],
  low: ['Low', 'منخفض'],
  none: ['Info', 'معلومة'],
};

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeek(baseDate: Date) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { key: dayKey(date), date };
  });
}

function resolveIssueDate(issue: Issue): Date | null {
  const rawDate = issue.dueDate
    ?? (issue.status === 'done' ? issue.updatedAt : issue.lastActivityAt ?? issue.updatedAt);

  if (!rawDate) return null;

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function uniqueIssues(issues: Issue[]) {
  const byId = new Map<string, Issue>();
  for (const issue of issues) {
    if (!byId.has(issue.id)) byId.set(issue.id, issue);
  }
  return Array.from(byId.values());
}

function isMeeting(issue: Issue) {
  const text = `${issue.title} ${issue.description ?? ''}`;
  return MEETING_RE.test(text);
}

function isMonitor(issue: Issue) {
  const text = `${issue.title} ${issue.description ?? ''}`;
  return issue.priority === 'critical'
    || issue.priority === 'high'
    || issue.status === 'in_review'
    || MONITOR_RE.test(text);
}

function sortByPriorityThenRecent(issues: Issue[]) {
  const priorityOrder: Record<IssuePriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  };

  return [...issues].sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const aDate = resolveIssueDate(a)?.getTime() ?? 0;
    const bDate = resolveIssueDate(b)?.getTime() ?? 0;
    return bDate - aDate;
  });
}

function formatHour(hour: number, isAr: boolean) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(isAr ? 'ar-JO' : 'en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatHourRange(startHour: number, endHour: number, isAr: boolean) {
  return `${formatHour(startHour, isAr)} - ${formatHour(endHour, isAr)}`;
}

function PChip({ priority, isAr }: { priority: IssuePriority; isAr: boolean }) {
  const [en, ar] = P_MAP[priority] ?? ['Info', 'معلومة'];
  return <SeverityChip severity={priorityToSeverity(priority)} labelEn={en} labelAr={ar} isAr={isAr} small />;
}

function SLabel({ en, ar, isAr }: { en: string; ar: string; isAr: boolean }) {
  return (
    <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest mb-2">
      {isAr ? ar : en}
    </h2>
  );
}

export function AttentionNow() {
  const navigate = useNavigate();
  const { t, isAr } = useLang();
  const d = useDashboardData();

  const weekDays = useMemo(() => buildWeek(new Date()), []);
  const weekKeys = useMemo(() => new Set(weekDays.map((day) => day.key)), [weekDays]);

  const weekRange = `${weekDays[0].date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })} - ${weekDays[6].date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })}`;

  const allIssues = useMemo(
    () => uniqueIssues([
      ...d.topIssues,
      ...d.dailyBrief,
      ...d.priorities,
      ...d.interventions,
      ...d.coordAlerts,
      ...d.publicPulse,
      ...d.servicePainPoints,
      ...d.watchlist,
      ...d.readinessItems,
      ...d.followUps,
      ...d.decisionsRequired,
    ]),
    [
      d.topIssues,
      d.dailyBrief,
      d.priorities,
      d.interventions,
      d.coordAlerts,
      d.publicPulse,
      d.servicePainPoints,
      d.watchlist,
      d.readinessItems,
      d.followUps,
      d.decisionsRequired,
    ],
  );

  const tx = useAutoTranslate(
    useMemo(() => allIssues.map((issue) => issue.title), [allIssues]),
    isAr,
  );

  const meetingIssues = useMemo(
    () => sortByPriorityThenRecent(allIssues.filter(isMeeting)),
    [allIssues],
  );

  const nonMeetingIssues = useMemo(
    () => sortByPriorityThenRecent(allIssues.filter((issue) => !isMeeting(issue))),
    [allIssues],
  );

  const todayKey = dayKey(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const selectedDayIndex = weekDays.findIndex((d) => d.key === selectedDayKey);
  const selectedDayPlan = selectedDayIndex >= 0 ? OFFICE_WEEK_PLAN[selectedDayIndex % OFFICE_WEEK_PLAN.length] : null;

  const todayOrders = useMemo(
    () => nonMeetingIssues
      .filter((issue) => issue.status !== 'done' && issue.status !== 'cancelled')
      .slice(0, 8),
    [nonMeetingIssues],
  );

  const doneThisWeek = useMemo(
    () => nonMeetingIssues
      .filter((issue) => issue.status === 'done')
      .filter((issue) => {
        const date = resolveIssueDate(issue);
        return date ? weekKeys.has(dayKey(date)) : false;
      })
      .slice(0, 8),
    [nonMeetingIssues, weekKeys],
  );

  const monitorThisWeek = useMemo(
    () => nonMeetingIssues
      .filter((issue) => issue.status !== 'done')
      .filter(isMonitor)
      .slice(0, 8),
    [nonMeetingIssues],
  );

  const weeklyTaskByDay = useMemo(() => {
    const byDay = new Map<string, Issue[]>();
    for (const day of weekDays) byDay.set(day.key, []);

    const overflow: Issue[] = [];

    for (const issue of nonMeetingIssues) {
      const date = resolveIssueDate(issue);
      const key = date ? dayKey(date) : null;
      if (!key || !byDay.has(key)) {
        overflow.push(issue);
        continue;
      }
      byDay.get(key)!.push(issue);
    }

    overflow.forEach((issue, index) => {
      const day = weekDays[index % weekDays.length];
      byDay.get(day.key)!.push(issue);
    });

    return byDay;
  }, [nonMeetingIssues, weekDays]);

  const kpis = [
    {
      value: meetingIssues.length,
      labelEn: 'Meetings This Week',
      labelAr: 'اجتماعات هذا الأسبوع',
      alert: false,
    },
    {
      value: todayOrders.length,
      labelEn: 'Today Orders',
      labelAr: 'أوامر اليوم',
      alert: false,
    },
    {
      value: doneThisWeek.length,
      labelEn: 'Done This Week',
      labelAr: 'تم إنجازه هذا الأسبوع',
      alert: false,
    },
    {
      value: monitorThisWeek.length,
      labelEn: 'Must Monitor',
      labelAr: 'يجب مراقبته',
      alert: true,
    },
  ];

  return (
    <div className="px-5 sm:px-8 py-8 space-y-8 max-w-[1700px] mx-auto">
      <div>
        <p className="text-[10px] text-twin-text-3 tracking-widest uppercase mb-2">
          {new Date().toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <h1 className="text-3xl font-black text-twin-text tracking-tight leading-tight">
          {t('Minister Weekly Office Calendar', 'تقويم المكتب الوزاري الأسبوعي')}
        </h1>
        <p className="text-sm text-twin-text-3 mt-1">
          {t(
            'One dedicated meetings calendar, plus structured weekly orders, monitoring, and completed work.',
            'تقويم مخصص للاجتماعات، مع تنظيم واضح لأوامر الأسبوع والمتابعة وما تم إنجازه.',
          )}
        </p>
        <p className="text-[11px] text-twin-text-3 mt-1">
          {t(
            'Calendar subjects are populated with ministry-office dummy schedule for planning simulations.',
            'مواضيع التقويم مبنية على جدول تجريبي واقعي لمكتب الوزارة لأغراض المحاكاة والتنظيم.',
          )}
        </p>
        <p className="text-xs text-twin-accent/80 mt-2 font-semibold uppercase tracking-[0.14em]">{weekRange}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi, index) => (
          <div
            key={index}
            className={`bg-twin-card border rounded-xl px-5 py-5 flex flex-col gap-2 ${
              kpi.alert && kpi.value > 0 ? 'border-red-700/50' : 'border-twin-border'
            }`}
          >
            <span
              className={`text-4xl font-black tabular-nums leading-none ${
                kpi.alert && kpi.value > 0 ? 'text-red-400' : 'text-twin-text'
              }`}
            >
              {d.isLoading ? <span className="opacity-20 text-2xl">-</span> : kpi.value}
            </span>
            <span className="text-[10px] text-twin-text-3 uppercase tracking-widest font-bold">
              {isAr ? kpi.labelAr : kpi.labelEn}
            </span>
          </div>
        ))}
      </div>

      <div>
        <SLabel en="Weekly Schedule" ar="جدول الأسبوع" isAr={isAr} />

        {/* Compact day-picker chips */}
        <div className="flex gap-1.5 flex-wrap">
          {weekDays.map((day) => {
            const isToday = day.key === todayKey;
            const isSelected = day.key === selectedDayKey;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => setSelectedDayKey(isSelected ? null : day.key)}
                className={[
                  'flex flex-col items-center px-3 py-2 rounded-xl border transition-colors min-w-[58px]',
                  isSelected
                    ? 'bg-twin-accent border-twin-accent text-black'
                    : isToday
                    ? 'border-twin-accent/70 bg-twin-hover/40 text-twin-text hover:bg-twin-hover'
                    : 'border-twin-border bg-twin-card text-twin-text hover:border-twin-accent/50 hover:bg-twin-hover/30',
                ].join(' ')}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-black' : 'text-twin-text-3'}`}>
                  {day.date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { weekday: 'short' })}
                </span>
                <span className={`text-lg font-black leading-tight mt-0.5 ${isSelected ? 'text-black' : isToday ? 'text-twin-accent' : 'text-twin-text'}`}>
                  {day.date.getDate()}
                </span>
                {isToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-twin-accent mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Day agenda — only shown when a day is selected */}
        {selectedDayPlan === null ? (
          <div className="mt-4 rounded-xl border border-twin-border bg-twin-card px-6 py-10 text-center">
            <p className="text-sm text-twin-text-3">
              {t('Select a day above to view its schedule.', 'اختاري يومًا من الأعلى لعرض جدوله.')}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-twin-border bg-twin-card overflow-hidden">
            {/* Selected day header */}
            <div className="px-5 py-3 border-b border-twin-border flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-twin-text">
                  {weekDays[selectedDayIndex].date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="text-[11px] text-twin-text-3 mt-0.5">
                  {isAr ? selectedDayPlan.themeAr : selectedDayPlan.themeEn}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="text-[11px] text-twin-text-3 hover:text-twin-text px-2 py-1 rounded border border-transparent hover:border-twin-border transition-colors"
              >
                {t('Close', 'إغلاق')}
              </button>
            </div>

            {/* Timeline */}
            <div className="divide-y divide-twin-border/50">
              {selectedDayPlan.slots.map((slot, i) => (
                <div key={i} className="flex items-start gap-4 px-5 py-3">
                  {/* Time column */}
                  <div className="w-24 flex-shrink-0 text-end">
                    <p className="text-[11px] font-semibold text-twin-text-2">
                      {formatHour(slot.startHour, isAr)}
                    </p>
                    <p className="text-[10px] text-twin-text-3">
                      {formatHour(slot.endHour, isAr)}
                    </p>
                  </div>

                  {/* Color bar */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${slot.colorClass}`} />

                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-twin-text leading-snug">
                      {isAr ? slot.subjectAr : slot.subjectEn}
                    </p>
                    <p className="text-[11px] text-twin-text-3 mt-0.5">
                      {isAr ? slot.laneAr : slot.laneEn}
                    </p>
                    <p className="text-[10px] text-twin-text-3/70 mt-0.5">
                      {formatHourRange(slot.startHour, slot.endHour, isAr)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <SLabel en="Weekly Office Summary" ar="ملخص المكتب الأسبوعي" isAr={isAr} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DashboardPanel label="Today Orders" labelAr="أوامر اليوم" noPadding>
            {d.isLoading ? (
              <div className="h-28 animate-pulse" />
            ) : todayOrders.length === 0 ? (
              <div className="px-4 py-6 text-sm text-twin-text-3 text-center">
                {t('No orders for today.', 'لا توجد أوامر لليوم.')}
              </div>
            ) : (
              todayOrders.map((issue) => (
                <ExecListItem
                  key={issue.id}
                  title={tx(issue.title)}
                  severity={priorityToSeverity(issue.priority)}
                  chip={<PChip priority={issue.priority} isAr={isAr} />}
                  onClick={() => navigate(`/issue/${issue.id}`)}
                />
              ))
            )}
          </DashboardPanel>

          <DashboardPanel label="Must Monitor" labelAr="بنود المتابعة" noPadding>
            {d.isLoading ? (
              <div className="h-28 animate-pulse" />
            ) : monitorThisWeek.length === 0 ? (
              <div className="px-4 py-6 text-sm text-twin-text-3 text-center">
                {t('No monitor alerts this week.', 'لا توجد تنبيهات متابعة هذا الأسبوع.')}
              </div>
            ) : (
              monitorThisWeek.map((issue) => (
                <ExecListItem
                  key={issue.id}
                  title={tx(issue.title)}
                  severity={priorityToSeverity(issue.priority)}
                  chip={<PChip priority={issue.priority} isAr={isAr} />}
                  onClick={() => navigate(`/issue/${issue.id}`)}
                />
              ))
            )}
          </DashboardPanel>

          <DashboardPanel label="Completed This Week" labelAr="المنجز هذا الأسبوع" noPadding>
            {d.isLoading ? (
              <div className="h-28 animate-pulse" />
            ) : doneThisWeek.length === 0 ? (
              <div className="px-4 py-6 text-sm text-twin-text-3 text-center">
                {t('No completed items yet.', 'لا توجد مهام مكتملة بعد.')}
              </div>
            ) : (
              doneThisWeek.map((issue) => (
                <ExecListItem
                  key={issue.id}
                  title={tx(issue.title)}
                  severity="good"
                  chip={<PChip priority={issue.priority} isAr={isAr} />}
                  onClick={() => navigate(`/issue/${issue.id}`)}
                />
              ))
            )}
          </DashboardPanel>
        </div>
      </div>

      <div>
        <SLabel en="Workload By Day" ar="توزيع العمل على الأيام" isAr={isAr} />
        <div className="rounded-xl border border-twin-border bg-twin-card p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const items = weeklyTaskByDay.get(day.key) ?? [];
            const active = items.filter((issue) => issue.status !== 'done').length;
            const done = items.filter((issue) => issue.status === 'done').length;
            const top = items[0];

            return (
              <div key={day.key} className={`rounded-lg border p-2.5 ${day.key === todayKey ? 'border-twin-accent/70 bg-twin-hover/40' : 'border-twin-border bg-twin-bg/30'}`}>
                <p className="text-[11px] font-semibold text-twin-text">
                  {day.date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { weekday: 'short' })}
                </p>
                <p className="text-[10px] text-twin-text-3 mt-0.5">
                  {day.date.toLocaleDateString(isAr ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short' })}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-twin-text-3">
                  <span>{t('Active', 'نشط')}: {active}</span>
                  <span>{t('Done', 'مكتمل')}: {done}</span>
                </div>
                {top && (
                  <button
                    type="button"
                    onClick={() => navigate(`/issue/${top.id}`)}
                    className="mt-2 w-full text-start rounded-md border border-twin-border px-2 py-1.5 text-[11px] text-twin-text line-clamp-2 hover:border-twin-border-mid transition-colors"
                  >
                    {tx(top.title)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {d.isError && (
        <p className="text-xs text-red-400 text-center pb-4">
          {t('Could not reach intelligence system.', 'تعذّر الوصول إلى النظام.')}
        </p>
      )}
    </div>
  );
}
