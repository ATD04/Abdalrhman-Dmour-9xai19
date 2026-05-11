import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'

const API = 'http://localhost:8000'

const ENTITY_AR = {
  MOH: '\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0635\u062d\u0629',
  GAM: '\u0623\u0645\u0627\u0646\u0629 \u0639\u0645\u0627\u0646 \u0627\u0644\u0643\u0628\u0631\u0649',
  CSPD: '\u062f\u0627\u0626\u0631\u0629 \u0627\u0644\u0623\u062d\u0648\u0627\u0644 \u0627\u0644\u0645\u062f\u0646\u064a\u0629',
  MOL: '\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0639\u0645\u0644',
  MOE: '\u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u062a\u0631\u0628\u064a\u0629',
}
const ENTITY_COLOR = {
  MOH: '#ef4444', GAM: '#3b82f6', CSPD: '#8b5cf6', MOL: '#f59e0b', MOE: '#06b6d4',
}
const SOURCE_AR = {
  bekhedmetkom: '\u0628\u062e\u062f\u0645\u062a\u0643\u0645',
  call_center: '\u0645\u0631\u0643\u0632 \u0627\u0644\u0627\u062a\u0635\u0627\u0644',
  email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a',
  survey: '\u0627\u0644\u0627\u0633\u062a\u0628\u064a\u0627\u0646',
  app: '\u0627\u0644\u062a\u0637\u0628\u064a\u0642',
}
const ROOT_CAUSE_AR = {
  infrastructure_deficit: '\u0646\u0642\u0635 \u0627\u0644\u0628\u0646\u064a\u0629 \u0627\u0644\u062a\u062d\u062a\u064a\u0629',
  process_failure: '\u0641\u0634\u0644 \u0625\u062c\u0631\u0627\u0626\u064a',
  policy_gap: '\u0641\u062c\u0648\u0629 \u0641\u064a \u0627\u0644\u0633\u064a\u0627\u0633\u0629',
  communication_breakdown: '\u0627\u0646\u0647\u064a\u0627\u0631 \u0627\u0644\u062a\u0648\u0627\u0635\u0644',
  staff_capacity: '\u0642\u062f\u0631\u0629 \u0627\u0644\u0643\u0648\u0627\u062f\u0631',
}
const SEVERITY_AR = { critical: '\u062d\u0631\u062c', high: '\u0639\u0627\u0644\u064d', medium: '\u0645\u062a\u0648\u0633\u0637' }
const SEVERITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b' }
const PRIORITY_AR = { gold: '\u0630\u0647\u0628\u064a\u0629', silver: '\u0641\u0636\u064a\u0629', quick_win: '\u0625\u0646\u062c\u0627\u0632 \u0633\u0631\u064a\u0639' }
const PRIORITY_COLOR = { gold: '#f59e0b', silver: '#9ca3af', quick_win: '#00d4aa' }
const STATUS_ACTION_AR = {
  proposed: '\u0645\u0642\u062a\u0631\u062d', approved: '\u0645\u0639\u062a\u0645\u062f',
  in_progress: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u0646\u0641\u064a\u0630', completed: '\u0645\u0643\u062a\u0645\u0644',
}
const STATUS_ACTION_COLOR = {
  proposed: '#6b7280', approved: '#3b82f6', in_progress: '#f59e0b', completed: '#10b981',
}
const PIE_COLORS = ['#00d4aa', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

const fmt1 = (n) => typeof n === 'number' ? n.toFixed(1) : '\u2014'

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        border: '4px solid #00d4aa33', borderTop: '4px solid #00d4aa',
        animation: 'spin 1s linear infinite',
      }} />
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#1a1d2e', borderRadius: 12,
      border: '1px solid #2a2d3e', padding: 16, ...style,
    }}>
      {children}
    </div>
  )
}

function Badge({ text, color = '#6b7280' }) {
  return (
    <span style={{
      background: color + '22', color, borderRadius: 6, padding: '2px 8px',
      fontSize: 12, fontWeight: 600, border: `1px solid ${color}44`, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      color: '#fff', fontSize: 15, fontWeight: 700, marginBottom: 14, marginTop: 0,
      borderRight: '3px solid #00d4aa', paddingRight: 10,
    }}>
      {children}
    </h2>
  )
}

// ── Screen 1: Dashboard ───────────────────────────────────────────────────────

function KpiTile({ label, value, badge, badgeColor = '#6b7280' }) {
  return (
    <Card>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}>{value}</div>
      <div style={{ marginTop: 8 }}>
        <Badge text={badge} color={badgeColor} />
      </div>
    </Card>
  )
}

function CxiBar({ entity, score }) {
  const color = score >= 75 ? '#00d4aa' : score >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>{ENTITY_AR[entity] || entity}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700 }}>{fmt1(score)}</span>
      </div>
      <div style={{ background: '#0f1117', borderRadius: 4, height: 7, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(score, 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  )
}

function DashboardScreen() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/dashboard/national`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />
  if (!data) return (
    <div style={{ color: '#ef4444', textAlign: 'center', padding: 48, fontSize: 16 }}>
      {'\u062e\u0637\u0623 \u0641\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u2014 \u062a\u0623\u0643\u062f \u0645\u0646 \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u062e\u0627\u062f\u0645 \u0627\u0644\u062e\u0644\u0641\u064a'}
    </div>
  )

  const slaColor = data.sla_compliance_rate >= 95 ? '#00d4aa' : data.sla_compliance_rate >= 90 ? '#f59e0b' : '#ef4444'
  const cxiColor = data.national_cxi >= 75 ? '#00d4aa' : data.national_cxi >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Row 1 — KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
        <KpiTile
          label={'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0634\u0643\u0627\u0648\u0649'}
          value={data.total_complaints.toLocaleString('ar')}
          badge={'\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u0648\u0644 2026'} badgeColor="#00d4aa"
        />
        <KpiTile
          label={'\u0634\u0643\u0627\u0648\u0649 \u0645\u0641\u062a\u0648\u062d\u0629'}
          value={data.open_complaints.toLocaleString('ar')}
          badge={`${fmt1(data.open_rate_percent)}% \u0645\u0646 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a`} badgeColor="#ef4444"
        />
        <KpiTile
          label={'\u0642\u064a\u062f \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629'}
          value={data.in_progress_complaints.toLocaleString('ar')}
          badge={'\u062c\u0627\u0631\u064d \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629'} badgeColor="#f59e0b"
        />
        <KpiTile
          label={'\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0627\u0633\u062a\u062c\u0627\u0628\u0629'}
          value={`${fmt1(data.avg_response_time_hours / 24)} \u064a\u0648\u0645`}
          badge={`${fmt1(data.sla_compliance_rate)}% SLA`} badgeColor={slaColor}
        />
        <KpiTile
          label={'\u0645\u0639\u062f\u0644 \u0627\u0644\u0627\u0645\u062a\u062b\u0627\u0644 SLA'}
          value={`${fmt1(data.sla_compliance_rate)}%`}
          badge={data.sla_compliance_rate >= 95 ? '\u0645\u0645\u062a\u0627\u0632 \u2713' : data.sla_compliance_rate >= 90 ? '\u062c\u064a\u062f' : '\u064a\u062d\u062a\u0627\u062c \u062a\u062d\u0633\u064a\u0646'}
          badgeColor={slaColor}
        />
      </div>

      {/* Row 2 — CXI card + trend chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '38% 62%', gap: 16 }}>
        <Card>
          <SectionTitle>{'\u0645\u0624\u0634\u0631 \u062a\u062c\u0631\u0628\u0629 \u0627\u0644\u0645\u0648\u0627\u0637\u0646 \u0627\u0644\u0648\u0637\u0646\u064a'}</SectionTitle>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div style={{ fontSize: 60, fontWeight: 900, color: cxiColor, lineHeight: 1 }}>
              {fmt1(data.national_cxi)}
            </div>
            <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>{'\u0645\u0646 \u0623\u0635\u0644 100 \u0646\u0642\u0637\u0629'}</div>
          </div>
          {Object.entries(data.cxi_breakdown).map(([entity, score]) => (
            <CxiBar key={entity} entity={entity} score={score} />
          ))}
        </Card>

        <Card>
          <SectionTitle>{'\u0627\u0644\u0645\u0633\u0627\u0631 \u0627\u0644\u0634\u0647\u0631\u064a \u0644\u0644\u0634\u0643\u0627\u0648\u0649 \u2014 \u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0623\u0648\u0644 2026'}</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly_trend} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3e" />
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8, fontFamily: 'Tajawal, sans-serif' }}
                labelStyle={{ color: '#fff' }} itemStyle={{ color: '#9ca3af' }}
              />
              <Legend
                wrapperStyle={{ color: '#9ca3af', fontSize: 13 }}
                formatter={v => v === 'total' ? '\u0625\u062c\u0645\u0627\u0644\u064a' : '\u0645\u0641\u062a\u0648\u062d\u0629'}
              />
              <Bar dataKey="total" name="total" fill="#00d4aa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="open" name="open" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 3 — Category donut + source bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card>
          <SectionTitle>{'\u062a\u0648\u0632\u064a\u0639 \u0627\u0644\u0634\u0643\u0627\u0648\u0649 \u062d\u0633\u0628 \u0627\u0644\u0641\u0626\u0629'}</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ flexShrink: 0 }}>
              <PieChart width={200} height={200}>
                <Pie
                  data={data.category_distribution} dataKey="count" nameKey="category"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={92}
                >
                  {data.category_distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1d2e', border: '1px solid #2a2d3e', borderRadius: 8 }}
                  itemStyle={{ color: '#9ca3af' }}
                />
              </PieChart>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {data.category_distribution.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ color: '#9ca3af', fontSize: 11, flex: 1 }}>{c.category}</span>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>{fmt1(c.percentage)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle>{'\u062a\u0648\u0632\u064a\u0639 \u062d\u0633\u0628 \u0642\u0646\u0627\u0629 \u0627\u0644\u062a\u0648\u0627\u0635\u0644'}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.source_distribution.map((s, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ color: '#e5e7eb', fontSize: 13 }}>{SOURCE_AR[s.source] || s.source}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{s.count.toLocaleString('ar')}</span>
                    <span style={{ color: PIE_COLORS[i % PIE_COLORS.length], fontSize: 12, fontWeight: 700 }}>
                      {fmt1(s.percentage)}%
                    </span>
                  </div>
                </div>
                <div style={{ background: '#0f1117', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${s.percentage}%`, height: '100%',
                    background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 4,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Screen 2: AI Intelligence ─────────────────────────────────────────────────

function ClusterCard({ cluster }) {
  const sevColor = SEVERITY_COLOR[cluster.severity] || '#6b7280'
  const entColor = ENTITY_COLOR[cluster.entity] || '#6b7280'
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Badge text={SEVERITY_AR[cluster.severity] || cluster.severity} color={sevColor} />
        <Badge text={cluster.entity} color={entColor} />
        <Badge text={`${(cluster.confidence_score * 100).toFixed(0)}% \u062b\u0642\u0629`} color="#00d4aa" />
      </div>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 6, lineHeight: 1.5 }}>
        {cluster.title_ar}
      </div>
      <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 12, lineHeight: 1.7 }}>
        {cluster.root_cause_ar}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ color: '#6b7280', fontSize: 12 }}>
          <span style={{ color: '#00d4aa', fontWeight: 700 }}>{cluster.size}</span>
          {' \u0634\u0643\u0648\u0649'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {cluster.open_rate > 0 && (
            <Badge
              text={`${fmt1(cluster.open_rate)}% \u0645\u0641\u062a\u0648\u062d\u0629`}
              color={cluster.open_rate > 20 ? '#ef4444' : cluster.open_rate > 10 ? '#f59e0b' : '#6b7280'}
            />
          )}
          <Badge text={ROOT_CAUSE_AR[cluster.root_cause_type] || cluster.root_cause_type} color="#8b5cf6" />
        </div>
      </div>
    </Card>
  )
}

function ActionCard({ action }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Badge text={PRIORITY_AR[action.priority] || action.priority} color={PRIORITY_COLOR[action.priority] || '#6b7280'} />
        <Badge text={STATUS_ACTION_AR[action.status] || action.status} color={STATUS_ACTION_COLOR[action.status] || '#6b7280'} />
      </div>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4, lineHeight: 1.5 }}>
        {action.title_ar}
      </div>
      <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 12 }}>{action.owner}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: '#9ca3af' }}>{action.implementation_days} {'\u064a\u0648\u0645 \u062a\u0646\u0641\u064a\u0630'}</span>
        <span style={{ color: '#00d4aa', fontWeight: 700 }}>{fmt1(action.expected_impact_percent)}% {'\u0623\u062b\u0631 \u0645\u062a\u0648\u0642\u0639'}</span>
      </div>
      <div style={{ background: '#0f1117', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(action.expected_impact_percent, 100)}%`,
          height: '100%', background: '#00d4aa', borderRadius: 4,
        }} />
      </div>
    </Card>
  )
}

function AIScreen() {
  const [clusters, setClusters] = useState([])
  const [actions, setActions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/clusters`).then(r => r.json()),
      fetch(`${API}/api/actions`).then(r => r.json()),
    ])
      .then(([c, a]) => { setClusters(c); setActions(a); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const avgConf = clusters.length
    ? (clusters.reduce((s, c) => s + c.confidence_score, 0) / clusters.length * 100).toFixed(0)
    : '0'

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <Card>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{'\u0639\u062f\u062f \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629'}</div>
          <div style={{ color: '#00d4aa', fontSize: 30, fontWeight: 800 }}>{clusters.length}</div>
        </Card>
        <Card>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{'\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062b\u0642\u0629'}</div>
          <div style={{ color: '#00d4aa', fontSize: 30, fontWeight: 800 }}>{avgConf}%</div>
        </Card>
        <Card>
          <div style={{ color: '#9ca3af', fontSize: 12, marginBottom: 4 }}>{'\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u0642\u062a\u0631\u062d\u0629'}</div>
          <div style={{ color: '#00d4aa', fontSize: 30, fontWeight: 800 }}>{actions.length}</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 20 }}>
        <div>
          <SectionTitle>{'\u0645\u062c\u0645\u0648\u0639\u0627\u062a \u0627\u0644\u0634\u0643\u0627\u0648\u0649 \u0648\u0627\u0644\u0623\u0633\u0628\u0627\u0628 \u0627\u0644\u062c\u0630\u0631\u064a\u0629'}</SectionTitle>
          <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingLeft: 6 }}>
            {clusters.map(c => <ClusterCard key={c.id} cluster={c} />)}
          </div>
        </div>
        <div>
          <SectionTitle>{'\u0627\u0644\u0625\u062c\u0631\u0627\u0621\u0627\u062a \u0627\u0644\u0645\u064a\u062f\u0627\u0646\u064a\u0629 \u0627\u0644\u0627\u0633\u062a\u0628\u0627\u0642\u064a\u0629'}</SectionTitle>
          <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingLeft: 6 }}>
            {actions.map(a => <ActionCard key={a.id} action={a} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screen 3: Simulation ──────────────────────────────────────────────────────

function SimCard({ sim, onRefetch }) {
  const [busy, setBusy] = useState(false)
  const isRunning = sim.status === 'running'

  async function handleAction() {
    setBusy(true)
    try {
      const endpoint = isRunning ? 'reset' : 'trigger'
      await fetch(`${API}/api/simulations/${sim.id}/${endpoint}`, { method: 'POST' })
      onRefetch()
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 6, flexWrap: 'wrap' }}>
        <Badge text={sim.scenario_type} color="#8b5cf6" />
        {isRunning ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#00d4aa', fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4aa', display: 'inline-block', animation: 'livePulse 1s ease-in-out infinite' }} />
            {'\u064a\u0639\u0645\u0644 \u0627\u0644\u0622\u0646'}
          </span>
        ) : (
          <Badge text={'\u063a\u064a\u0631 \u0646\u0634\u0637'} color="#6b7280" />
        )}
      </div>
      <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{sim.name}</div>
      <div style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>{sim.description}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {(sim.affected_entities || []).map(e => (
          <Badge key={e} text={e} color={ENTITY_COLOR[e] || '#6b7280'} />
        ))}
      </div>
      <div style={{ background: '#0f1117', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
        <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 6, fontWeight: 600 }}>{'\u062a\u0623\u062b\u064a\u0631\u0627\u062a \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062a'}</div>
        {Object.entries(sim.kpi_effects || {}).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: '#6b7280' }}>{k}</span>
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>{String(v)}</span>
          </div>
        ))}
      </div>
      <button
        onClick={handleAction}
        disabled={busy}
        style={{
          width: '100%', border: 'none', borderRadius: 8, padding: '10px 16px',
          fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.7 : 1, fontFamily: 'Tajawal, sans-serif',
          background: isRunning ? '#ef4444' : '#00d4aa',
          color: isRunning ? '#fff' : '#000',
        }}
      >
        {busy ? '...' : isRunning ? '\u0625\u064a\u0642\u0627\u0641 \u0648\u0625\u0639\u0627\u062f\u0629 \u062a\u0639\u064a\u064a\u0646' : '\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629'}
      </button>
    </Card>
  )
}

function SignalCard({ signal }) {
  const sevColor = signal.severity === 'critical' ? '#ef4444'
    : signal.severity === 'high' ? '#f97316'
    : signal.severity === 'medium_high' ? '#f59e0b' : '#6b7280'
  const isPulsing = signal.severity === 'critical' || signal.severity === 'high'

  return (
    <Card>
      <div style={{ textAlign: 'center', marginBottom: 12, position: 'relative', paddingTop: 8 }}>
        {isPulsing && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 72, height: 72, borderRadius: '50%',
            background: sevColor + '22',
            animation: 'pulseRing 2s ease-in-out infinite',
          }} />
        )}
        <div style={{ fontSize: 44, fontWeight: 900, color: sevColor, position: 'relative', lineHeight: 1 }}>
          {fmt1(signal.signal_value)}%
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <Badge text={signal.severity} color={sevColor} />
        <Badge text={signal.signal_type} color="#8b5cf6" />
      </div>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <Badge text={signal.entity} color={ENTITY_COLOR[signal.entity] || '#6b7280'} />
      </div>
      <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
        {ENTITY_AR[signal.entity] || signal.entity} {'\u2014'} {signal.governorate}
      </div>
      <div style={{ color: '#e5e7eb', fontSize: 12, textAlign: 'center', marginBottom: 10 }}>
        {signal.interpretation}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ color: '#6b7280', fontSize: 11 }}>{'\u0627\u0644\u062b\u0642\u0629'}</span>
        <span style={{ color: '#00d4aa', fontSize: 12, fontWeight: 700 }}>
          {(signal.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{ background: '#0f1117', borderRadius: 8, padding: '8px 10px' }}>
        {Object.entries(signal.supporting_data || {}).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: '#6b7280' }}>{k}</span>
            <span style={{ color: '#9ca3af' }}>{String(v)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function SimulationScreen() {
  const [sims, setSims] = useState([])
  const [signals, setSignals] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = () => {
    Promise.all([
      fetch(`${API}/api/simulations`).then(r => r.json()),
      fetch(`${API}/api/signals`).then(r => r.json()),
    ])
      .then(([s, sig]) => { setSims(s); setSignals(sig); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, margin: '0 0 6px 0' }}>
          {'\u0645\u062d\u0631\u0643 \u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629 \u0627\u0644\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629'}
        </h2>
        <p style={{ color: '#6b7280', fontSize: 13, margin: 0 }}>
          {'\u0627\u062e\u062a\u0628\u0631 \u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u0623\u0632\u0645\u0627\u062a \u0642\u0628\u0644 \u0648\u0642\u0648\u0639\u0647\u0627'}
        </p>
      </div>

      <SectionTitle>{'\u0627\u0644\u0633\u064a\u0646\u0627\u0631\u064a\u0648\u0647\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629'}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
        {sims.map(s => <SimCard key={s.id} sim={s} onRefetch={fetchAll} />)}
      </div>

      <SectionTitle>{'\u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u0628\u0627\u0642\u064a\u0629 \u0627\u0644\u0645\u062a\u0642\u062f\u0645\u0629'}</SectionTitle>
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 16, marginTop: -8 }}>
        {'\u0625\u0634\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0634\u0643\u0648\u0649 \u062a\u0646\u0628\u0626 \u0628\u0645\u0634\u0627\u0643\u0644 \u0642\u0627\u062f\u0645\u0629'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {signals.map(s => <SignalCard key={s.id} signal={s} />)}
      </div>
    </div>
  )
}


// ── Submit Complaint ───────────────────────────────────────────────────────────────────

function ProgressBar({ duration = 30000 }) {
  const [pct, setPct] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => {
      const p = Math.min((Date.now() - start) / duration * 100, 100)
      setPct(p)
      if (p >= 100) clearInterval(t)
    }, 200)
    return () => clearInterval(t)
  }, [duration])
  return (
    <div style={{ background: '#0f1117', borderRadius: 4, height: 8, overflow: 'hidden', width: '100%' }}>
      <div style={{
        width: `${pct}%`, height: '100%', background: '#00d4aa',
        borderRadius: 4, transition: 'width 0.2s linear',
      }} />
    </div>
  )
}

function TrackingModal({ trackingNumber, onClose }) {
  const [query, setQuery] = useState(trackingNumber || '')
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [err, setErr] = useState('')

  async function search() {
    const clean = query.trim().replace('VOC-', '').toLowerCase()
    if (!clean) return
    setSearching(true); setErr(''); setResult(null)
    try {
      const res = await fetch(`${API}/api/complaints/track/${clean}`)
      if (!res.ok) throw new Error('not found')
      setResult(await res.json())
    } catch { setErr('لم يتم العثور على الشكوى / Complaint not found') }
    finally { setSearching(false) }
  }

  const statusColor = { open: '#ef4444', in_progress: '#f59e0b', resolved: '#10b981' }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#1a1d2e', borderRadius: 16, border: '1px solid #2a2d3e',
        padding: 28, width: '100%', maxWidth: 500, position: 'relative',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, left: 16, background: 'transparent',
          border: 'none', color: '#6b7280', fontSize: 20, cursor: 'pointer', lineHeight: 1,
          fontFamily: 'Tajawal, sans-serif',
        }}>✕</button>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 20px', textAlign: 'center' }}>
          {'تتبع حالة الشكوى / Track Complaint Status'}
        </h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="VOC-XXXXXXXX"
            style={{
              flex: 1, background: '#0f1117', border: '1px solid #2a2d3e',
              borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14,
              fontFamily: 'monospace', outline: 'none',
            }}
          />
          <button onClick={search} disabled={searching} style={{
            background: '#00d4aa', color: '#000', border: 'none', borderRadius: 8,
            padding: '10px 18px', fontWeight: 700, cursor: searching ? 'not-allowed' : 'pointer',
            fontSize: 14, fontFamily: 'Tajawal, sans-serif', opacity: searching ? 0.7 : 1,
          }}>
            {searching ? '...' : 'بحث / Search'}
          </button>
        </div>
        {err && (
          <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{err}</div>
        )}
        {result && (
          <div style={{ background: '#0f1117', borderRadius: 12, padding: 16, border: '1px solid #2a2d3e' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ color: '#00d4aa', fontSize: 22, fontWeight: 800, fontFamily: 'monospace' }}>
                {result.tracking_number}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>
                  {'الحالة / Status'}
                </div>
                <Badge text={result.status_ar} color={statusColor[result.status] || '#6b7280'} />
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>
                  {'الجهة / Entity'}
                </div>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{result.entity_ar}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>
                  {'الفئة / Category'}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 12 }}>{result.category}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 11, marginBottom: 3 }}>
                  {'تاريخ التقديم'}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 12 }}>
                  {new Date(result.submitted_at).toLocaleDateString('ar-JO')}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              {result.processed_by_ai
                ? <span style={{ color: '#10b981', fontSize: 13, fontWeight: 700 }}>{'\u2713 معالج بالذكاء الاصطناعي'}</span>
                : <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>{'⏳ قيد المعالجة'}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LiveFeed() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  function load() {
    fetch(`${API}/api/complaints/recent`)
      .then(r => r.json())
      .then(d => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const urgColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981' }
  const urgAr = {
    critical: 'حرج',
    high: 'عالٍ',
    medium: 'متوسط',
    low: 'منخفض',
  }
  const entBadge = {
    MOH: { ar: 'وزارة الصحة', color: '#3b82f6' },
    GAM: { ar: 'أمانة عمان', color: '#10b981' },
    CSPD: { ar: 'الأحوال المدنية', color: '#8b5cf6' },
    MOL: { ar: 'وزارة العمل', color: '#f59e0b' },
    MOE: { ar: 'التربية', color: '#06b6d4' },
  }
  const sentEmoji = { angry: '😠', negative: '😞', neutral: '😐', positive: '😊' }

  return (
    <Card style={{ height: 'fit-content' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <SectionTitle>{'آخر الشكاوى المستلمة'}</SectionTitle>
        <span style={{ color: '#6b7280', fontSize: 11 }}>
          {'يتجدد كل 15 ثانية'}
        </span>
      </div>
      {loading ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 32, fontSize: 14 }}>
          {'جارٍ التحميل...'}
        </div>
      ) : items.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 48, fontSize: 14 }}>
          {'لا توجد شكاوى حتى الآن'}
        </div>
      ) : (
        <div style={{ maxHeight: 580, overflowY: 'auto', paddingLeft: 4 }}>
          {items.map(item => {
            const eb = entBadge[item.entity] || { ar: item.entity, color: '#6b7280' }
            return (
              <div key={item.id} style={{
                background: '#0f1117', borderRadius: 10, border: '1px solid #2a2d3e',
                padding: '10px 12px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ color: '#00d4aa', fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                    {item.tracking_number}
                  </span>
                  <Badge
                    text={urgAr[item.urgency] || item.urgency}
                    color={urgColor[item.urgency] || '#6b7280'}
                  />
                </div>
                <div style={{
                  color: '#e5e7eb', fontSize: 12, lineHeight: 1.5, marginBottom: 7,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {item.text_preview}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Badge text={eb.ar} color={eb.color} />
                  <span style={{ color: '#6b7280', fontSize: 11 }}>{item.governorate}</span>
                  <span style={{ fontSize: 13 }}>{sentEmoji[item.sentiment] || '😐'}</span>
                  {item.category !== 'pending'
                    ? <span style={{ color: '#00d4aa', fontSize: 11, fontWeight: 700 }}>{'\u26a1 AI'}</span>
                    : <span style={{ color: '#6b7280', fontSize: 11 }}>{'\u23f3'}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function SubmitScreen() {
  const [lang, setLang] = useState('ar')
  const ar = lang === 'ar'
  const [text, setText] = useState('')
  const [gov, setGov] = useState('عمّان')
  const [source, setSource] = useState('bekhedmetkom')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)
  const [showModal, setShowModal] = useState(false)

  const govs = [
    'عمّان', 'إربد', 'الزرقاء',
    'العقبة', 'المفرق', 'جرش',
    'مادبا', 'الكرك', 'عجلون',
    'الطفيلة', 'معان', 'البلقاء',
  ]

  async function handleSubmit() {
    if (text.trim().length < 3) {
      setError(ar
        ? 'يرجى كتابة نص الشكوى (3 أحرف على الأقل)'
        : 'Please enter complaint text (at least 3 characters)')
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${API}/api/complaints/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), source, governorate: gov, name: name || undefined, language: lang }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setSuccess(data)
    } catch {
      setError(ar
        ? 'حدث خطأ في الإرسال. يرجى المحاولة مجدداً.'
        : 'Submission error. Please try again.')
    } finally { setSubmitting(false) }
  }

  function reset() {
    setText('')
    setGov('عمّان')
    setSource('bekhedmetkom')
    setName('')
    setError('')
    setSuccess(null)
    setShowModal(false)
  }

  const inputStyle = {
    width: '100%', background: '#0f1117', border: '1px solid #2a2d3e',
    borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14,
    fontFamily: 'Tajawal, sans-serif', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = {
    color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 6, fontWeight: 600,
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {showModal && success && (
        <TrackingModal trackingNumber={success.tracking_number} onClose={() => setShowModal(false)} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', gap: 20 }}>
        {/* LEFT — Form */}
        <Card>
          <SectionTitle>
            {ar ? 'تقديم شكوى جديدة' : 'Submit a New Complaint'}
          </SectionTitle>
          {/* Language toggle */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, direction: 'ltr' }}>
            {['ar', 'en'].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 16px', borderRadius: 8, border: 'none',
                background: lang === l ? '#00d4aa' : '#0f1117',
                color: lang === l ? '#000' : '#9ca3af',
                fontWeight: 700, cursor: 'pointer', fontSize: 13,
                fontFamily: 'Tajawal, sans-serif',
              }}>
                {l === 'ar' ? 'العربية' : 'English'}
              </button>
            ))}
          </div>

          {!success ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>
                  {ar ? 'نص الشكوى *' : 'Complaint Text *'}
                </label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={ar
                    ? 'اكتب شكواك هنا بالتفصيل... كلما كانت أكثر تفصيلاً كلما كانت المعالجة أدق'
                    : 'Describe your complaint in detail. The more detail, the better the AI can process it.'}
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical' }}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  {ar ? 'المحافظة' : 'Governorate'}
                </label>
                <select value={gov} onChange={e => setGov(e.target.value)} style={inputStyle}>
                  {govs.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>
                  {ar ? 'قناة التواصل' : 'Submission Channel'}
                </label>
                <select value={source} onChange={e => setSource(e.target.value)} style={inputStyle}>
                  <option value="bekhedmetkom">{ar ? 'بخدمتكم' : 'Bekhedmetkom'}</option>
                  <option value="email">{ar ? 'البريد الإلكتروني' : 'Email'}</option>
                  <option value="app">{ar ? 'التطبيق' : 'Mobile App'}</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>
                  {ar ? 'الاسم (اختياري)' : 'Name (optional)'}
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={ar ? 'مواطن' : 'Citizen'}
                  style={inputStyle}
                />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: '100%', background: submitting ? '#00d4aa99' : '#00d4aa',
                  color: '#000', border: 'none', borderRadius: 10, padding: '12px 20px',
                  fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: 'Tajawal, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {submitting ? (
                  <>
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid #00000033', borderTop: '2px solid #000',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    {ar ? 'جارٍ الإرسال...' : 'Sending...'}
                  </>
                ) : (
                  ar ? 'إرسال الشكوى ←' : 'Submit Complaint →'
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '12px 0' }}>
              <div style={{ fontSize: 64, color: '#10b981', lineHeight: 1, textAlign: 'center' }}>✓</div>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, textAlign: 'center' }}>
                {ar ? 'تم استلام شكواك!' : 'Complaint Received!'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ color: '#00d4aa', fontSize: 22, fontWeight: 900, fontFamily: 'monospace' }}>
                  {success.tracking_number}
                </span>
                <button
                  onClick={() => navigator.clipboard?.writeText(success.tracking_number)}
                  style={{
                    background: '#0f1117', border: '1px solid #2a2d3e', borderRadius: 6,
                    padding: '4px 10px', color: '#9ca3af', fontSize: 12, cursor: 'pointer',
                    fontFamily: 'Tajawal, sans-serif',
                  }}
                >
                  {ar ? 'نسخ' : 'Copy'}
                </button>
              </div>
              <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                {ar
                  ? 'يعالج الذكاء الاصطناعي شكواك الآن...'
                  : 'AI is processing your complaint...'}
              </div>
              <div style={{ width: '100%' }}>
                <ProgressBar duration={30000} />
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    flex: 1, background: 'transparent', border: '2px solid #00d4aa',
                    color: '#00d4aa', borderRadius: 10, padding: '10px 0',
                    fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif',
                  }}
                >
                  {ar ? 'تتبع الشكوى' : 'Track Status'}
                </button>
                <button
                  onClick={reset}
                  style={{
                    flex: 1, background: '#2a2d3e', border: 'none',
                    color: '#9ca3af', borderRadius: 10, padding: '10px 0',
                    fontWeight: 700, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif',
                  }}
                >
                  {ar ? 'شكوى جديدة' : 'New Complaint'}
                </button>
              </div>
            </div>
          )}
        </Card>
        {/* RIGHT — Live feed */}
        <LiveFeed />
      </div>
    </div>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────────

const TABS = [
  { label: '\u0644\u0648\u062d\u0629 360', Screen: DashboardScreen },
  { label: '\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a', Screen: AIScreen },
  { label: '\u270d\ufe0f \u062a\u0642\u062f\u064a\u0645 \u0634\u0643\u0648\u0649', Screen: SubmitScreen },
  { label: '\u0627\u0644\u0645\u062d\u0627\u0643\u0627\u0629', Screen: SimulationScreen },
]

export default function App() {
  const [tab, setTab] = useState(0)

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    document.body.style.margin = '0'
    document.body.style.background = '#0f1117'
  }, [])

  const { Screen } = TABS[tab]
  const dateStr = new Date().toLocaleDateString('ar-JO', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #0f1117; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.25); }
        }
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0f1117; }
        ::-webkit-scrollbar-thumb { background: #2a2d3e; border-radius: 3px; }
      `}</style>

      <div dir="rtl" style={{ fontFamily: 'Tajawal, sans-serif', background: '#0f1117', minHeight: '100vh' }}>
        {/* Fixed top nav */}
        <nav style={{
          position: 'fixed', top: 0, right: 0, left: 0, height: 64, zIndex: 200,
          background: '#1a1d2e', borderBottom: '2px solid #00d4aa',
          display: 'flex', alignItems: 'center', padding: '0 28px', gap: 20,
        }}>
          {/* Brand */}
          <div style={{ minWidth: 170 }}>
            <div style={{ color: '#00d4aa', fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>
              {'\u0645\u0646\u0635\u0629 \u0628\u062e\u062f\u0645\u062a\u0643\u0645'}
            </div>
            <div style={{ color: '#6b7280', fontSize: 11 }}>Voice of Citizen 360</div>
          </div>

          {/* Tabs */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {TABS.map((t, i) => (
              <button
                key={i}
                onClick={() => setTab(i)}
                style={{
                  background: tab === i ? '#00d4aa' : 'transparent',
                  color: tab === i ? '#000' : '#9ca3af',
                  border: `1px solid ${tab === i ? '#00d4aa' : '#2a2d3e'}`,
                  borderRadius: 8, padding: '6px 22px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Live dot + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
            <span style={{
              display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
              background: '#00d4aa', animation: 'livePulse 2s ease-in-out infinite',
            }} />
            <div>
              <div style={{ color: '#00d4aa', fontSize: 12, fontWeight: 700 }}>{'\u0628\u064a\u0627\u0646\u0627\u062a \u0645\u0628\u0627\u0634\u0631\u0629'}</div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>{dateStr}</div>
            </div>
          </div>
        </nav>

        {/* Page body */}
        <div style={{ paddingTop: 64 }}>
          <Screen />
        </div>
      </div>
    </>
  )
}
