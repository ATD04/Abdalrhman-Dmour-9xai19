import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { fetchIssues, fetchComments } from '../api';
import { PROJECTS, getCapMeta } from '../config';
import type { CapKey } from '../config';
import { useLang } from '../context/LangContext';
import type { Issue } from '../types';

const STATUS_TABS = [
  { value: '', label: 'All', labelAr: 'الكل' },
  { value: 'in_progress', label: 'Active', labelAr: 'نشطة' },
  { value: 'todo', label: 'Todo', labelAr: 'قادمة' },
  { value: 'done', label: 'Done', labelAr: 'مكتملة' },
  { value: 'backlog', label: 'Backlog', labelAr: 'قائمة الانتظار' },
] as const;

const PRIORITY_COLOR: Record<Issue['priority'], string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-slate-400',
  none:     'text-slate-600',
};

const STATUS_COLOR: Record<Issue['status'], string> = {
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_review:   'bg-purple-500/20 text-purple-300 border-purple-500/30',
  todo:        'bg-slate-600/20 text-slate-300 border-slate-600/30',
  backlog:     'bg-slate-700/20 text-slate-400 border-slate-700/30',
  done:        'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  cancelled:   'bg-red-500/20 text-red-300 border-red-500/30',
};

function IssueRow({ issue }: { issue: Issue }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useLang();

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['comments', issue.id],
    queryFn: () => fetchComments(issue.id),
    enabled: expanded,
  });

  return (
    <div className="border-b border-twin-border last:border-0">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-twin-hover/40 transition-colors text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <span className={`text-xs w-4 shrink-0 font-bold ${PRIORITY_COLOR[issue.priority]}`}>
          {issue.priority === 'critical' ? '!!' : issue.priority === 'high' ? '!' : '·'}
        </span>
        <span className={`badge border shrink-0 ${STATUS_COLOR[issue.status]}`}>
          {issue.status.replace('_', ' ')}
        </span>
        <span className="text-xs font-mono text-slate-600 shrink-0">{issue.identifier}</span>
        <span className="text-sm text-slate-200 flex-1 truncate">{issue.title}</span>
        <span className="text-[10px] text-slate-600 shrink-0">
          {new Date(issue.updatedAt).toLocaleDateString()}
        </span>
        {expanded ? <ChevronUp size={12} className="text-slate-500 shrink-0" /> : <ChevronDown size={12} className="text-slate-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-twin-card/30">
          {issue.description && (
            <p className="text-sm text-slate-400 mb-3 leading-relaxed whitespace-pre-wrap border-l-2 border-twin-border pl-3">
              {issue.description}
            </p>
          )}
          <div className="text-[11px] text-slate-500 mb-3 flex gap-4">
            <span>{t('Created', 'إنشاء')}: {new Date(issue.createdAt).toLocaleString()}</span>
            {issue.dueDate && <span>{t('Due', 'الموعد')}: {new Date(issue.dueDate).toLocaleDateString()}</span>}
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {t('Agent Activity', 'نشاط الوكيل')}
            </p>
            {loadingComments ? (
              <p className="text-xs text-slate-600">{t('Loading...', 'جاري التحميل...')}</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-slate-600">{t('No activity yet', 'لا يوجد نشاط بعد')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {comments.map(c => (
                  <div key={c.id} className="bg-twin-card border border-twin-border rounded p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="text-[10px] text-slate-500">
                        {c.authorType === 'agent' ? t('Agent', 'الوكيل') : t('Board', 'اللوحة')} · {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {c.body.length > 400 ? c.body.slice(0, 400) + '…' : c.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface Props { capKey: CapKey; }

export function CapabilityPage({ capKey }: Props) {
  const { t } = useLang();
  const cap = getCapMeta(capKey);
  const projectId = PROJECTS[capKey];

  const [statusFilter, setStatusFilter] = useState('');

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ['issues', capKey],
    queryFn: () => fetchIssues({ projectId }),
  });

  const triggerMutation = { mutate: () => {}, isPending: false, isError: false };

  const displayed = statusFilter
    ? issues.filter(i => i.status === statusFilter)
    : issues;

  const total = issues.length;
  const done = issues.filter(i => i.status === 'done').length;
  const active = issues.filter(i => i.status === 'in_progress' || i.status === 'in_review').length;
  const todo = issues.filter(i => i.status === 'todo').length;

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${cap.bgColor} border ${cap.borderColor} flex items-center justify-center text-xl shrink-0`}>
            {cap.emoji}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">{t(cap.labelEn, cap.labelAr)}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t(cap.descEn, cap.descAr)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="btn-ghost">
            <RefreshCw size={12} />
            {t('Refresh', 'تحديث')}
          </button>
          <button
            onClick={() => {}}
            disabled
            className="btn-ghost"
          >
            {t('Run Agent', 'تشغيل الوكيل')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: t('Total', 'الإجمالي'), value: total, color: 'text-slate-200' },
          { label: t('Done', 'مكتملة'), value: done, color: 'text-emerald-400' },
          { label: t('Active', 'نشطة'), value: active, color: 'text-blue-400' },
          { label: t('Todo', 'قادمة'), value: todo, color: 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <p className="text-[11px] text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{isLoading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card px-4 py-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">{t('Completion', 'الإنجاز')}</span>
            <span className={`text-xs font-semibold ${cap.color}`}>
              {Math.round((done / total) * 100)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-twin-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-twin-accent to-amber-500 transition-all"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Trigger feedback */}
      {triggerMutation.isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-4 text-sm text-red-400">
          <AlertCircle size={14} />
          {t('Failed to trigger run', 'فشل تشغيل الوكيل')}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              statusFilter === tab.value
                ? `${cap.bgColor} ${cap.color} border ${cap.borderColor}`
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t(tab.label, tab.labelAr)}
            {tab.value === '' ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      {/* Issues list */}
      {isLoading ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          {t('Loading issues…', 'جاري التحميل…')}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          {t('No issues found', 'لا توجد مهام')}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {displayed
            .sort((a, b) => {
              const pa = ['critical','high','medium','low','none'].indexOf(a.priority);
              const pb = ['critical','high','medium','low','none'].indexOf(b.priority);
              return pa - pb;
            })
            .map(issue => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
        </div>
      )}
    </div>
  );
}
