import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { fetchIssue, fetchComments } from '../api';
import { useLang } from '../context/LangContext';
import { SeverityChip, priorityToSeverity } from '../components/SeverityChip';
import { parseDescription } from '../utils/parseDescription';
import { relativeDate } from '../utils/textUtils';
import { PROJECTS } from '../config';
import type { CapKey } from '../config';
import type { IssuePriority } from '../types';

// ─── Project label map ────────────────────────────────────────────────────────

const KEY_LABELS: Record<CapKey, { en: string; ar: string }> = {
  cos:          { en: 'Chief of Staff',             ar: 'رئيس الديوان'      },
  radar:        { en: 'Executive Radar',             ar: 'الرادار التنفيذي'  },
  friction:     { en: 'Service Friction',            ar: 'احتكاك الخدمات'   },
  voice:        { en: 'Citizen Voice',               ar: 'صوت المواطن'       },
  readiness:    { en: 'Readiness',                  ar: 'الجاهزية'          },
  policy:       { en: 'Policy',                     ar: 'السياسات'          },
  coordination: { en: 'Coordination',               ar: 'التنسيق'           },
};

const ID_TO_KEY: Record<string, CapKey> = Object.fromEntries(
  (Object.entries(PROJECTS) as [CapKey, string][]).map(([k, v]) => [v, k])
);

function projectLabel(projectId: string | null | undefined, isAr: boolean): string {
  if (!projectId) return '';
  const key = ID_TO_KEY[projectId];
  return key ? (isAr ? KEY_LABELS[key].ar : KEY_LABELS[key].en) : '';
}

// ─── Priority chip ────────────────────────────────────────────────────────────

const P_MAP: Record<IssuePriority, [string, string]> = {
  critical: ['Critical', 'حرجي'],
  high:     ['High',     'مرتفع'],
  medium:   ['Medium',   'متوسط'],
  low:      ['Low',      'منخفض'],
  none:     ['Info',     'معلومة'],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ heading, text, items }: { heading: string; text: string; items: string[] }) {
  if (!heading && !text && items.length === 0) return null;
  return (
    <div className="bg-twin-card border border-twin-border rounded-xl p-5 flex flex-col gap-3">
      {heading && (
        <h3 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest">{heading}</h3>
      )}
      {text && (
        <p className="text-sm text-twin-text-2 leading-relaxed">{text}</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-twin-text-2">
              <span className="w-4 h-4 rounded-full bg-twin-border-mid text-twin-text-3 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RagAlert({ text }: { text: string }) {
  const isRed    = /🔴/.test(text);
  const isAmber  = /🟡|🟠/.test(text);
  const cls      = isRed
    ? 'border-red-700/50 bg-red-950/20 text-red-300'
    : isAmber
    ? 'border-amber-700/40 bg-amber-950/20 text-amber-300'
    : 'border-emerald-800/40 bg-emerald-950/20 text-emerald-300';
  return (
    <div className={`border rounded-lg px-4 py-2.5 text-sm leading-snug ${cls}`}>
      {text}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DecisionRoom() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, isAr } = useLang();

  const { data: issue, isLoading: issueLoad, isError: issueError } = useQuery({
    queryKey: ['issue', id],
    queryFn:  () => fetchIssue(id!),
    enabled:  !!id,
    staleTime: 60_000,
  });

  const { data: comments = [], isLoading: commLoad } = useQuery({
    queryKey: ['comments', id],
    queryFn:  () => fetchComments(id!),
    enabled:  !!id,
    staleTime: 60_000,
  });

  const parsed = parseDescription(issue?.description);
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  // Priority chip
  const priority = issue?.priority ?? 'none';
  const [pEn, pAr] = P_MAP[priority] ?? ['Info', 'معلومة'];

  // Show the most relevant sections (skip empty, limit to 5)
  const visibleSections = parsed.sections
    .filter(s => s.text.length > 10 || s.items.length > 0)
    .slice(0, 6);

  // Recent comments (max 6)
  const recentComments = [...comments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  if (issueError) {
    return (
      <div className="px-5 sm:px-8 py-12 text-center">
        <p className="text-twin-text-3 text-sm">
          {t('Could not load this intelligence report.', 'تعذّر تحميل هذا التقرير الاستخباراتي.')}
        </p>
        <button onClick={() => navigate(-1)} className="mt-4 btn-ghost">
          {t('Go Back', 'العودة')}
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 space-y-8 max-w-[1400px] mx-auto">

      {/* Back navigation ─────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/attention')}
        className="flex items-center gap-2 text-twin-text-3 hover:text-twin-text-2 transition-colors text-sm"
      >
        <BackIcon size={14} />
        {t('Executive Overview', 'النظرة التنفيذية')}
      </button>

      {/* Issue header ────────────────────────────────────────────── */}
      <div className="space-y-3">
        {issueLoad ? (
          <div className="space-y-2">
            <div className="h-4 w-32 bg-twin-card border border-twin-border rounded animate-pulse" />
            <div className="h-8 w-3/4 bg-twin-card border border-twin-border rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 flex-wrap">
              {issue?.identifier && (
                <span className="text-[10px] font-mono text-twin-text-3 border border-twin-border px-2 py-0.5 rounded">
                  {issue.identifier}
                </span>
              )}
              <span className="text-[10px] font-semibold text-twin-text-3 uppercase tracking-widest border border-twin-border px-2 py-0.5 rounded">
                {projectLabel(issue?.projectId, isAr)}
              </span>
              <SeverityChip
                severity={priorityToSeverity(priority)}
                labelEn={pEn}
                labelAr={pAr}
                isAr={isAr}
                small
              />
              {issue?.lastActivityAt && (
                <span className="text-[10px] text-twin-text-3">
                  {relativeDate(issue.lastActivityAt, isAr)}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-twin-text leading-tight tracking-tight">
              {issue?.title}
            </h1>
          </>
        )}
      </div>

      {/* Executive Summary hero ───────────────────────────────────── */}
      {!issueLoad && parsed.summary && (
        <div className="bg-twin-card border border-twin-border rounded-xl px-6 py-5 border-s-2 border-s-twin-accent">
          <p className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest mb-2">
            {t('Executive Summary', 'الملخص التنفيذي')}
          </p>
          <p className="text-base text-twin-text leading-relaxed">{parsed.summary}</p>
        </div>
      )}

      {/* RAG Alerts ──────────────────────────────────────────────── */}
      {!issueLoad && parsed.ragAlerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest">
            {t('Status Indicators', 'مؤشرات الحالة')}
          </h2>
          <div className="space-y-1.5">
            {parsed.ragAlerts.map((alert, i) => (
              <RagAlert key={i} text={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions ─────────────────────────────────────── */}
      {!issueLoad && parsed.actions.length > 0 && (
        <div className="bg-twin-card border border-twin-border rounded-xl p-5">
          <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest mb-4">
            {t('Recommended Actions', 'الإجراءات الموصى بها')}
          </h2>
          <ol className="space-y-3">
            {parsed.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full border border-twin-border-hi text-twin-text-2 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm text-twin-text leading-relaxed">{action}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Two-column: Sections + Agent Intelligence ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Situation sections */}
        {!issueLoad && visibleSections.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest">
              {t('Situation Analysis', 'تحليل الوضع')}
            </h2>
            {visibleSections.map((sec, i) => (
              <SectionCard key={i} heading={sec.heading} text={sec.text} items={sec.items} />
            ))}
          </div>
        )}

        {/* Agent Intelligence (comments) */}
        <div className="space-y-3">
          <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest">
            {t('Agent Intelligence', 'استخبارات الوكلاء')}
          </h2>
          {commLoad ? (
            Array.from({ length: 3 }).map((_, k) => (
              <div key={k} className="h-24 bg-twin-card border border-twin-border rounded-xl animate-pulse" />
            ))
          ) : recentComments.length === 0 ? (
            <div className="bg-twin-card border border-twin-border rounded-xl px-5 py-8 text-center">
              <p className="text-sm text-twin-text-3">
                {t('No agent reports yet.', 'لا تقارير وكلاء بعد.')}
              </p>
            </div>
          ) : (
            recentComments.map(comment => (
              <div key={comment.id} className="bg-twin-card border border-twin-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-twin-text-3 uppercase tracking-widest">
                    {comment.authorType === 'agent'
                      ? t('Intelligence Agent', 'وكيل استخباراتي')
                      : t('Analyst', 'محلل')}
                  </span>
                  <span className="text-[10px] text-twin-text-3 tabular-nums">
                    {relativeDate(comment.createdAt, isAr)}
                  </span>
                </div>
                <p className="text-sm text-twin-text-2 leading-relaxed line-clamp-6">
                  {comment.body
                    .replace(/^#{1,6}\s+/gm, '')
                    .replace(/\*\*([^*]+)\*\*/g, '$1')
                    .replace(/\*([^*]+)\*/g, '$1')
                    .replace(/^\s*[-*+]\s+/gm, '• ')
                    .replace(/`([^`]+)`/g, '$1')
                    .trim()
                    .slice(0, 600)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Metrics (if any) ────────────────────────────────────────── */}
      {!issueLoad && parsed.metrics.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold text-twin-text-3 uppercase tracking-widest">
            {t('Key Metrics', 'المؤشرات الرئيسية')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {parsed.metrics.map((m, i) => (
              <div key={i} className="bg-twin-card border border-twin-border rounded-lg px-4 py-3 text-sm text-twin-text-2">
                {m}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full description toggle ─────────────────────────────────── */}
      {!issueLoad && issue?.description && (
        <details className="group">
          <summary className="cursor-pointer text-[10px] font-bold text-twin-text-3 uppercase tracking-widest hover:text-twin-text-2 transition-colors list-none flex items-center gap-2">
            <span className="border border-twin-border rounded px-2 py-0.5 group-open:border-twin-border-mid">
              {t('Full Intelligence Report', 'التقرير الاستخباراتي الكامل')}
            </span>
          </summary>
          <div className="mt-4 bg-twin-card border border-twin-border rounded-xl p-5">
            <pre className="text-xs text-twin-text-3 whitespace-pre-wrap leading-relaxed font-mono overflow-x-auto">
              {issue.description}
            </pre>
          </div>
        </details>
      )}

    </div>
  );
}
