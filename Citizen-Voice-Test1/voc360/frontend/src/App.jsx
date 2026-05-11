import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const API = "http://localhost:8000/api";

const G = {
  nav: "#004d29",
  primary: "#006633",
  primaryLight: "#008040",
  gold: "#c9a227",
  goldLight: "#e0b83a",
  bg: "#f0f5f2",
  card: "#ffffff",
  border: "#c8ddd2",
  text: "#1a2e22",
  textMuted: "#5a7a66",
  danger: "#c0392b",
  success: "#27ae60",
  warning: "#f39c12",
};

const ENTITY_COLORS = {
  MOH: "#006633", GAM: "#c9a227", CSPD: "#1a5276",
  MOL: "#7d3c98", MOE: "#d35400",
};

function api(path, opts = {}) {
  const auth = JSON.parse(localStorage.getItem("voc360_auth") || "null");
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
  return fetch(`${API}${path}`, { ...opts, headers });
}

// ─── LOGIN / SIGNUP SCREEN ──────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const body = mode === "login"
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, username: form.username, password: form.password };
      const res = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "حدث خطأ"); return; }
      const authData = { token: data.access_token, user: data.user };
      localStorage.setItem("voc360_auth", JSON.stringify(authData));
      onAuth(authData);
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: G.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Tajawal', sans-serif" }}>
      {/* Header bar */}
      <div style={{ background: G.nav, width: "100%", padding: "14px 32px", display: "flex", alignItems: "center", gap: 14, position: "fixed", top: 0, left: 0 }}>
        <span style={{ fontSize: 28, color: G.gold }}>⚜️</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: 1 }}>منصة بخدمتكم</div>
          <div style={{ color: G.gold, fontSize: 11 }}>المملكة الأردنية الهاشمية — صوت المواطن 360</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ background: G.card, borderRadius: 16, boxShadow: "0 4px 32px rgba(0,77,41,0.13)", padding: "40px 44px", width: 400, maxWidth: "90vw", marginTop: 80, border: `1px solid ${G.border}` }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚜️</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: G.text }}>
            {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
          </div>
          <div style={{ fontSize: 12, color: G.textMuted, marginTop: 4 }}>Voice of Citizen 360</div>
        </div>

        {error && (
          <div style={{ background: "#fdf0ef", border: `1px solid ${G.danger}`, borderRadius: 8, padding: "10px 14px", marginBottom: 18, color: G.danger, fontSize: 13, textAlign: "center" }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <>
              <input required value={form.name} onChange={set("name")} placeholder="الاسم الكامل" style={inputStyle} />
              <input required value={form.username} onChange={set("username")} placeholder="اسم المستخدم (username)" style={inputStyle} dir="ltr" />
            </>
          )}
          <input required type="email" value={form.email} onChange={set("email")} placeholder="البريد الإلكتروني" style={inputStyle} dir="ltr" />
          <input required type="password" value={form.password} onChange={set("password")} placeholder="كلمة المرور" style={inputStyle} dir="ltr" />
          <button type="submit" disabled={loading} style={{
            background: loading ? G.primaryLight : G.primary, color: "#fff", border: "none",
            borderRadius: 8, padding: "13px 0", fontSize: 15, fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            fontFamily: "'Tajawal', sans-serif",
          }}>
            {loading ? "جاري..." : mode === "login" ? "دخول" : "إنشاء حساب"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
          {mode === "login" ? (
            <span style={{ color: G.textMuted }}>ليس لديك حساب؟{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} style={linkBtn}>أنشئ حساباً</button>
            </span>
          ) : (
            <span style={{ color: G.textMuted }}>لديك حساب بالفعل؟{" "}
              <button onClick={() => { setMode("login"); setError(""); }} style={linkBtn}>سجّل الدخول</button>
            </span>
          )}
        </div>

        {mode === "login" && (
          <div style={{ marginTop: 20, background: "#f0f5f2", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: G.textMuted, textAlign: "center", border: `1px solid ${G.border}` }}>
            <strong style={{ color: G.primary }}>المدير الافتراضي:</strong><br />
            admin@voc360.jo / Admin@2026
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "11px 14px", border: `1px solid #c8ddd2`, borderRadius: 8,
  fontSize: 14, fontFamily: "'Tajawal', sans-serif", background: "#fafffe",
  color: "#1a2e22", outline: "none", width: "100%", boxSizing: "border-box",
};
const linkBtn = {
  background: "none", border: "none", color: "#006633", cursor: "pointer",
  fontWeight: 700, fontSize: 13, fontFamily: "'Tajawal', sans-serif", padding: 0,
};

// ─── NAVIGATION ─────────────────────────────────────────────────────────────
function Nav({ tabs, active, setActive, auth, onLogout }) {
  return (
    <div style={{ background: G.nav, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(0,0,0,0.25)", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
        <span style={{ fontSize: 26, color: G.gold }}>⚜️</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>منصة بخدمتكم</div>
          <div style={{ color: G.gold, fontSize: 10 }}>صوت المواطن 360</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            background: active === i ? G.gold : "transparent",
            color: active === i ? G.nav : "#c8e6d8",
            border: "none", padding: "8px 16px", borderRadius: 8,
            cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: "'Tajawal', sans-serif", transition: "all .2s",
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{auth.user.name}</div>
          <div style={{ color: G.gold, fontSize: 10 }}>{auth.user.role === "admin" ? "مدير النظام" : "مواطن"}</div>
        </div>
        <button onClick={onLogout} style={{
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          color: "#fff", padding: "6px 14px", borderRadius: 8, cursor: "pointer",
          fontSize: 12, fontFamily: "'Tajawal', sans-serif",
        }}>خروج</button>
      </div>
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, sub, color }) {
  return (
    <div style={{ background: G.card, borderRadius: 12, padding: "20px 24px", border: `1px solid ${G.border}`, flex: 1, minWidth: 160 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: color || G.primary }}>{value}</div>
          <div style={{ fontSize: 13, color: G.textMuted, marginTop: 2 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: G.gold, marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD SCREEN ────────────────────────────────────────────────────────
function DashboardScreen({ auth }) {
  const [stats, setStats] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes, kRes, rRes] = await Promise.all([
        api("/stats"), api("/clusters"), api("/kpis"), api("/complaints?limit=10"),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (cRes.ok) setClusters(await cRes.json());
      if (kRes.ok) setKpis(await kRes.json());
      if (rRes.ok) setRecent((await rRes.json()).complaints || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>جاري التحميل...</div>;

  const entityDist = stats?.entity_distribution
    ? Object.entries(stats.entity_distribution).map(([k, v]) => ({ name: k, value: v }))
    : [];
  const catDist = stats?.category_distribution
    ? Object.entries(stats.category_distribution).slice(0, 5).map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div style={{ padding: "24px 28px", background: G.bg, minHeight: "100vh" }}>
      {/* Top stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="إجمالي الشكاوى" value={stats?.total_complaints ?? "—"} icon="📋" color={G.primary} sub={`منها ${stats?.pending_count ?? 0} معلّقة`} />
        <StatCard label="معالجة بالذكاء الاصطناعي" value={stats?.ai_processed ?? "—"} icon="🤖" color="#1a5276" />
        <StatCard label="عالية الأولوية" value={stats?.high_priority ?? "—"} icon="🚨" color={G.danger} />
        <StatCard label="مجموعات نشطة" value={clusters.length} icon="🗂️" color="#7d3c98" />
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
        {/* Entity pie */}
        <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}`, flex: "1 1 320px" }}>
          <h3 style={{ margin: "0 0 16px", color: G.text, fontSize: 15 }}>توزيع الجهات</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={entityDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {entityDist.map((e) => <Cell key={e.name} fill={ENTITY_COLORS[e.name] || "#999"} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category bar */}
        <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}`, flex: "1 1 320px" }}>
          <h3 style={{ margin: "0 0 16px", color: G.text, fontSize: 15 }}>أبرز التصنيفات</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={catDist} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill={G.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}`, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", color: G.text, fontSize: 15 }}>مؤشرات الأداء (KPIs)</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {kpis.slice(0, 6).map((k) => (
              <div key={k.id} style={{ background: G.bg, borderRadius: 8, padding: "12px 16px", flex: "1 1 160px", border: `1px solid ${G.border}` }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.status === "on_track" ? G.success : G.warning }}>{k.current_value.toFixed(0)}</div>
                <div style={{ fontSize: 11, color: G.textMuted }}>{k.name}</div>
                <div style={{ fontSize: 10, color: k.status === "on_track" ? G.success : G.warning, marginTop: 2 }}>
                  {k.status === "on_track" ? "✓ على المسار" : "⚠ يحتاج مراجعة"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent complaints */}
      <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}` }}>
        <h3 style={{ margin: "0 0 14px", color: G.text, fontSize: 15 }}>آخر الشكاوى</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {["الرقم", "الجهة", "التصنيف", "الأولوية", "الحالة", "التاريخ"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "right", color: G.textMuted, fontWeight: 600, borderBottom: `2px solid ${G.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 ? G.bg : G.card, borderBottom: `1px solid ${G.border}` }}>
                  <td style={{ padding: "9px 12px", color: G.textMuted, fontSize: 11 }}>{c.id?.slice(0, 8)}…</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ background: ENTITY_COLORS[c.entity] || "#999", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{c.entity}</span>
                  </td>
                  <td style={{ padding: "9px 12px" }}>{c.category || "—"}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ color: c.urgency_score > 7 ? G.danger : c.urgency_score > 4 ? G.warning : G.success, fontWeight: 600 }}>
                      {c.urgency_score > 7 ? "عالية" : c.urgency_score > 4 ? "متوسطة" : "منخفضة"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: G.textMuted }}>{c.status || "—"}</td>
                  <td style={{ padding: "9px 12px", color: G.textMuted, fontSize: 11 }}>{c.created_at ? new Date(c.created_at).toLocaleDateString("ar-JO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── AI SCREEN ───────────────────────────────────────────────────────────────
function AIScreen({ auth }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    api("/signals").then((r) => r.ok && r.json()).then((d) => d && setSignals(d.slice(0, 4)));
  }, []);

  async function classify() {
    if (!text.trim()) return;
    setLoading(true); setResult(null);
    try {
      const res = await api("/ai/classify", { method: "POST", body: JSON.stringify({ text }) });
      if (res.ok) setResult(await res.json());
    } finally { setLoading(false); }
  }

  const Badge = ({ label, value, color }) => (
    <div style={{ background: G.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${G.border}` }}>
      <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, color: color || G.primary }}>{value}</div>
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", background: G.bg, minHeight: "100vh" }}>
      <div style={{ background: G.card, borderRadius: 12, padding: 24, border: `1px solid ${G.border}`, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 16px", color: G.text, fontSize: 16 }}>🤖 محرّك التصنيف الذكي</h2>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="اكتب نص الشكوى هنا للتصنيف الفوري..."
          rows={5}
          style={{ width: "100%", padding: 14, borderRadius: 8, border: `1px solid ${G.border}`, fontSize: 14, fontFamily: "'Tajawal', sans-serif", resize: "vertical", boxSizing: "border-box", background: "#fafffe" }}
        />
        <button onClick={classify} disabled={loading || !text.trim()} style={{
          marginTop: 12, background: G.primary, color: "#fff", border: "none",
          borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: "'Tajawal', sans-serif",
        }}>
          {loading ? "جاري التحليل..." : "حلّل الشكوى"}
        </button>
        {result && (
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Badge label="الجهة" value={result.entity} color={ENTITY_COLORS[result.entity]} />
            <Badge label="التصنيف" value={result.category} />
            <Badge label="المشاعر" value={result.sentiment} color={result.sentiment === "negative" ? G.danger : G.success} />
            <Badge label="الأولوية" value={`${result.urgency_score}/10`} color={result.urgency_score > 7 ? G.danger : G.warning} />
          </div>
        )}
      </div>

      {signals.length > 0 && (
        <div style={{ background: G.card, borderRadius: 12, padding: 24, border: `1px solid ${G.border}` }}>
          <h3 style={{ margin: "0 0 16px", color: G.text, fontSize: 15 }}>📡 الإشارات المتقدمة</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signals.map((s, i) => (
              <div key={i} style={{ background: G.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${G.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, color: G.text, fontSize: 13 }}>{s.signal_type}</div>
                  <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{s.description}</div>
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: s.severity > 7 ? G.danger : G.warning }}>{s.severity.toFixed(1)}</div>
                  <div style={{ fontSize: 10, color: G.textMuted }}>خطورة</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUBMIT SCREEN ───────────────────────────────────────────────────────────
const ENTITIES = [
  { value: "MOH", label: "وزارة الصحة", dept: "الخدمات الطبية" },
  { value: "GAM", label: "أمانة عمّان", dept: "الخدمات البلدية" },
  { value: "CSPD", label: "مديرية الأمن العام", dept: "الأمن والسلامة" },
  { value: "MOL", label: "وزارة العمل", dept: "شؤون العمل" },
  { value: "MOE", label: "وزارة التعليم", dept: "الخدمات التعليمية" },
];
const CATS = ["جودة الخدمة", "تأخير", "فساد", "سلوك موظف", "بنية تحتية", "أخرى"];
const GOVS = ["عمّان", "إربد", "الزرقاء", "العقبة", "المفرق", "الكرك", "السلط", "جرش", "عجلون", "مادبا", "الطفيلة", "معان"];

function LiveFeed() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = () => api("/complaints?limit=5").then((r) => r.ok && r.json()).then((d) => d?.complaints && setItems(d.complaints));
    load();
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}`, marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: G.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: G.success, display: "inline-block", animation: "pulse 2s infinite" }} />
        التغذية الراجعة المباشرة
      </div>
      {items.length === 0 && <div style={{ color: G.textMuted, fontSize: 13 }}>لا توجد بيانات بعد</div>}
      {items.map((c, i) => (
        <div key={c.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${G.border}` : "none", padding: "8px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, color: G.text, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.text?.slice(0, 60)}…
          </div>
          <span style={{ background: ENTITY_COLORS[c.entity] || "#999", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>{c.entity}</span>
        </div>
      ))}
    </div>
  );
}

function TrackingModal({ id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/complaints/${id}/track`).then((r) => r.ok && r.json()).then(setData);
  }, [id]);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <div style={{ background: G.card, borderRadius: 16, padding: 28, maxWidth: 480, width: "90vw", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, left: 16, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: G.textMuted }}>✕</button>
        <h3 style={{ margin: "0 0 18px", color: G.text }}>تتبع الشكوى</h3>
        {!data ? <div style={{ color: G.textMuted }}>جاري التحميل...</div> : (
          <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 10 }}>
            <div><strong>رقم الشكوى:</strong> <span style={{ fontFamily: "monospace" }}>{data.complaint_id?.slice(0, 16)}…</span></div>
            <div><strong>الجهة:</strong> {data.entity}</div>
            <div><strong>الحالة:</strong> {data.status}</div>
            <div><strong>التصنيف:</strong> {data.category}</div>
            <div><strong>الأولوية:</strong> {data.urgency_score}/10</div>
            <div><strong>المشاعر:</strong> {data.sentiment}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitScreen({ auth }) {
  const [form, setForm] = useState({ entity: "MOH", text: "", category: "جودة الخدمة", name: "", phone: "", governorate: "عمّان", source: "web" });
  const [status, setStatus] = useState(null);
  const [trackId, setTrackId] = useState(null);
  const [showTrack, setShowTrack] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setStatus("loading");
    try {
      const payload = { text: form.text, entity: form.entity, source: form.source, governorate: form.governorate, name: form.name || null, phone: form.phone || null, language: "ar" };
      const headers = { "Content-Type": "application/json" };
      if (auth?.token) headers["Authorization"] = `Bearer ${auth.token}`;
      const res = await fetch(`${API}/complaints/submit`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (res.ok) {
        const d = await res.json();
        setTrackId(d.complaint_id);
        setStatus("ok");
        setForm((p) => ({ ...p, text: "", name: "", phone: "" }));
        setFiles([]);
      } else { setStatus("err"); }
    } catch { setStatus("err"); }
  }

  const entityInfo = ENTITIES.find((e) => e.value === form.entity);

  return (
    <div style={{ padding: "24px 28px", background: G.bg, minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 500px" }}>
          <div style={{ background: G.card, borderRadius: 12, padding: 28, border: `1px solid ${G.border}` }}>
            <h2 style={{ margin: "0 0 6px", color: G.text, fontSize: 17 }}>✍️ تقديم شكوى أو اقتراح</h2>
            <p style={{ color: G.textMuted, fontSize: 12, margin: "0 0 22px" }}>ستُحلَّل شكواك بواسطة الذكاء الاصطناعي وتُوجَّه للجهة المختصة</p>

            {status === "ok" && (
              <div style={{ background: "#eafaf1", border: `1px solid ${G.success}`, borderRadius: 8, padding: "12px 16px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: G.success, fontWeight: 700 }}>✓ تم تقديم شكواك بنجاح!</span>
                {trackId && <button onClick={() => setShowTrack(true)} style={{ ...linkBtn, color: G.primary }}>تتبع الشكوى</button>}
              </div>
            )}
            {status === "err" && <div style={{ background: "#fdf0ef", border: `1px solid ${G.danger}`, borderRadius: 8, padding: "12px 16px", marginBottom: 18, color: G.danger }}>حدث خطأ أثناء الإرسال</div>}

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>الجهة الحكومية</label>
                  <select value={form.entity} onChange={set("entity")} style={selectStyle}>
                    {ENTITIES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>المحافظة</label>
                  <select value={form.governorate} onChange={set("governorate")} style={selectStyle}>
                    {GOVS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>تصنيف الشكوى</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CATS.map((c) => (
                    <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, category: c }))}
                      style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${form.category === c ? G.primary : G.border}`, background: form.category === c ? G.primary : "transparent", color: form.category === c ? "#fff" : G.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "'Tajawal', sans-serif" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>تفاصيل الشكوى *</label>
                <textarea required value={form.text} onChange={set("text")} rows={5}
                  placeholder="اشرح شكواك أو اقتراحك بالتفصيل..."
                  style={{ ...selectStyle, resize: "vertical", minHeight: 120 }} />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>الاسم (اختياري)</label>
                  <input value={form.name} onChange={set("name")} placeholder="اسمك الكريم" style={selectStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>رقم الجوال (اختياري)</label>
                  <input value={form.phone} onChange={set("phone")} placeholder="07xxxxxxxx" style={{ ...selectStyle }} dir="ltr" />
                </div>
              </div>

              {/* Drag drop area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); setFiles([...files, ...e.dataTransfer.files]); }}
                style={{ border: `2px dashed ${dragging ? G.primary : G.border}`, borderRadius: 8, padding: "20px", textAlign: "center", background: dragging ? "#e8f5ee" : G.bg, cursor: "pointer", fontSize: 13, color: G.textMuted, transition: "all .2s" }}>
                <div>📎 اسحب الملفات هنا أو <label style={{ color: G.primary, cursor: "pointer", fontWeight: 700 }}>
                  <input type="file" multiple hidden onChange={(e) => setFiles([...files, ...e.target.files])} />
                  انقر للرفع
                </label></div>
              </div>
              {files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ background: G.bg, borderRadius: 6, padding: "6px 12px", display: "flex", justifyContent: "space-between", fontSize: 12, border: `1px solid ${G.border}` }}>
                      <span>📄 {f.name}</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: G.danger, cursor: "pointer", fontSize: 13 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" disabled={status === "loading"} style={{
                background: G.primary, color: "#fff", border: "none", borderRadius: 8,
                padding: "13px 0", fontSize: 15, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Tajawal', sans-serif", marginTop: 4,
              }}>
                {status === "loading" ? "جاري الإرسال..." : "📤 إرسال الشكوى"}
              </button>
            </form>
          </div>
        </div>

        <div style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 16 }}>
          <LiveFeed />
          {entityInfo && (
            <div style={{ background: G.card, borderRadius: 12, padding: 20, border: `1px solid ${G.border}` }}>
              <div style={{ fontWeight: 700, color: G.text, marginBottom: 8 }}>الجهة المختارة</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: ENTITY_COLORS[form.entity] }}>{entityInfo.label}</div>
              <div style={{ color: G.textMuted, fontSize: 12, marginTop: 4 }}>{entityInfo.dept}</div>
              <div style={{ marginTop: 10, padding: "8px 12px", background: G.bg, borderRadius: 6, fontSize: 11, color: G.textMuted, border: `1px solid ${G.border}` }}>
                سيتم توجيه شكواك تلقائياً بعد تحليلها بالذكاء الاصطناعي
              </div>
            </div>
          )}
        </div>
      </div>
      {showTrack && trackId && <TrackingModal id={trackId} onClose={() => setShowTrack(false)} />}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, color: G.textMuted, marginBottom: 6, fontWeight: 600 };
const selectStyle = {
  width: "100%", padding: "10px 14px", border: `1px solid ${G.border}`, borderRadius: 8,
  fontSize: 14, fontFamily: "'Tajawal', sans-serif", background: "#fafffe", color: G.text,
  boxSizing: "border-box", outline: "none",
};

// ─── SIMULATION SCREEN ───────────────────────────────────────────────────────
function SimulationScreen({ auth }) {
  const [sims, setSims] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api("/simulations").then((r) => r.ok && r.json()).then((d) => {
      setSims(d || []);
      if (d?.length) setSelected(d[0]);
    });
  }, []);

  return (
    <div style={{ padding: "24px 28px", background: G.bg, minHeight: "100vh" }}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ background: G.card, borderRadius: 12, padding: 16, border: `1px solid ${G.border}` }}>
            <h3 style={{ margin: "0 0 14px", color: G.text, fontSize: 14 }}>السيناريوهات</h3>
            {sims.map((s) => (
              <div key={s.id} onClick={() => setSelected(s)} style={{
                padding: "10px 14px", borderRadius: 8, cursor: "pointer", marginBottom: 6,
                background: selected?.id === s.id ? G.primary : G.bg,
                color: selected?.id === s.id ? "#fff" : G.text,
                border: `1px solid ${selected?.id === s.id ? G.primary : G.border}`,
                fontSize: 13, fontWeight: 600,
              }}>
                {s.name}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: "3 1 400px" }}>
          {selected ? (
            <div style={{ background: G.card, borderRadius: 12, padding: 24, border: `1px solid ${G.border}` }}>
              <h2 style={{ margin: "0 0 8px", color: G.text, fontSize: 16 }}>{selected.name}</h2>
              <p style={{ color: G.textMuted, fontSize: 13, marginBottom: 20 }}>{selected.description}</p>
              {selected.projected_data && (() => {
                let chartData = [];
                try { chartData = typeof selected.projected_data === "string" ? JSON.parse(selected.projected_data) : selected.projected_data; } catch {}
                return Array.isArray(chartData) && chartData.length > 0 ? (
                  <div>
                    <h4 style={{ margin: "0 0 12px", color: G.text, fontSize: 13 }}>البيانات المتوقعة</h4>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={chartData}>
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="complaints" stroke={G.primary} strokeWidth={2} dot={false} />
                        {chartData[0]?.resolved !== undefined && <Line type="monotone" dataKey="resolved" stroke={G.gold} strokeWidth={2} dot={false} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : null;
              })()}
              <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                <div style={{ background: G.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${G.border}`, flex: 1 }}>
                  <div style={{ fontSize: 11, color: G.textMuted }}>معدل النجاح المتوقع</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: G.success }}>{selected.success_rate ? `${selected.success_rate}%` : "—"}</div>
                </div>
                <div style={{ background: G.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${G.border}`, flex: 1 }}>
                  <div style={{ fontSize: 11, color: G.textMuted }}>الجهة</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: ENTITY_COLORS[selected.entity] || G.primary }}>{selected.entity || "—"}</div>
                </div>
              </div>
            </div>
          ) : <div style={{ color: G.textMuted, textAlign: "center", padding: 60 }}>اختر سيناريو للعرض</div>}
        </div>
      </div>
    </div>
  );
}

// ─── USERS ADMIN SCREEN ──────────────────────────────────────────────────────
function UsersScreen({ auth }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/admin/users").then((r) => r.ok && r.json()).then((d) => { setUsers(d || []); setLoading(false); });
  }, []);
  return (
    <div style={{ padding: "24px 28px", background: G.bg, minHeight: "100vh" }}>
      <div style={{ background: G.card, borderRadius: 12, padding: 24, border: `1px solid ${G.border}` }}>
        <h2 style={{ margin: "0 0 18px", color: G.text, fontSize: 16 }}>👥 إدارة المستخدمين</h2>
        {loading ? <div style={{ color: G.textMuted }}>جاري التحميل...</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: G.bg }}>
                {["الاسم", "البريد الإلكتروني", "اسم المستخدم", "الدور", "تاريخ الإنشاء"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: "right", color: G.textMuted, fontWeight: 600, borderBottom: `2px solid ${G.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 ? G.bg : G.card, borderBottom: `1px solid ${G.border}` }}>
                  <td style={{ padding: "9px 12px", fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: "9px 12px", color: G.textMuted, fontSize: 12 }} dir="ltr">{u.email}</td>
                  <td style={{ padding: "9px 12px", color: G.textMuted, fontSize: 12 }} dir="ltr">{u.username}</td>
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{ background: u.role === "admin" ? G.primary : G.gold, color: u.role === "admin" ? "#fff" : G.nav, borderRadius: 4, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                      {u.role === "admin" ? "مدير" : "مواطن"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", color: G.textMuted, fontSize: 11 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("ar-JO") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem("voc360_auth") || "null"));
  const [activeTab, setActiveTab] = useState(0);

  function handleAuth(authData) { setAuth(authData); setActiveTab(0); }
  function handleLogout() { localStorage.removeItem("voc360_auth"); setAuth(null); setActiveTab(0); }

  if (!auth) return <AuthScreen onAuth={handleAuth} />;

  const isAdmin = auth.user?.role === "admin";

  const ADMIN_TABS = [
    { label: "لوحة 360", Screen: DashboardScreen },
    { label: "الذكاء الاصطناعي", Screen: AIScreen },
    { label: "✍️ تقديم شكوى", Screen: SubmitScreen },
    { label: "المحاكاة", Screen: SimulationScreen },
    { label: "👥 المستخدمون", Screen: UsersScreen },
  ];

  const USER_TABS = [
    { label: "✍️ تقديم شكوى", Screen: SubmitScreen },
  ];

  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;
  const safeActive = Math.min(activeTab, tabs.length - 1);
  const ActiveScreen = tabs[safeActive].Screen;

  return (
    <div dir="rtl" style={{ fontFamily: "'Tajawal', sans-serif", background: G.bg, minHeight: "100vh" }}>
      <Nav tabs={tabs} active={safeActive} setActive={setActiveTab} auth={auth} onLogout={handleLogout} />
      <ActiveScreen auth={auth} />
    </div>
  );
}
