import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  fetchConfidence,
  fetchExplanation,
  type ConfidenceResult,
  type ExplanationResult,
} from './agentApiClient';
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  MessageSquareText,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Ticket,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

type Role = 'guest' | 'user' | 'admin';
type View = 'chat' | 'tickets' | 'admin';
type AdminTab = 'knowledge' | 'users' | 'ministries';
type AssistantMode = 'concise' | 'detailed';
type PlatformRole = 'auditor' | 'ministry_admin_manager' | 'system_admin';

type StoredUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Exclude<Role, 'guest'>;
  platformRole: PlatformRole;
  ministry?: string;
};

type AuthState = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isGuest: boolean;
};

type Citation = {
  source_id: string;
  page: number;
  source_name: string;
  // FIX 5 — new fields from agent-service Citation model
  document_year?: number | null;
  is_amendment?: boolean;
  relevance_score?: number;
};

type MessageMeta = {
  confidence?: number;
  citations?: Citation[];
  escalated?: boolean;
  escalation_reason?: string | null;
  escalation_confirmation_required?: boolean;
  totalClientMs?: number;
  firstTokenMs?: number;
  streamChunkEvents?: number;
  chunks_used?: number;
  timings?: Record<string, number>;
  // FIX 3 — new fields from agent-service QueryResponse model
  agent_used?: string;
  sector?: string;
  has_amendments?: boolean;
  amendment_note?: string | null;
  session_id?: string;
  response_id?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
  metadata?: MessageMeta;
};

type Conversation = {
  id: string;
  title: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type WorkflowCase = {
  case_id: string;
  query: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  escalation_reason: string;
  sector_primary: string;
  created_at: string;
  resolution_answer?: string | null;
};

type CasesResponse = {
  cases?: WorkflowCase[];
};

type SourceInfo = {
  source_id: string;
  source_name: string;
  filename: string;
  file_type: string;
  doc_type: string;
  total_chunks: number;
  current_version: number;
  tags: string[];
  language: string;
  visibility: 'public' | 'internal' | 'confidential';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
};

type SourcesResponse = {
  sources?: SourceInfo[];
  total?: number;
};

type SourcePagesResponse = {
  source_id: string;
  pages: { page: number; image_url: string }[];
  page_count: number;
};

type KnowledgeRetrieveResult = {
  chunk_id: string;
  source_id: string;
  source_name: string;
  filename: string;
  page: number;
  text: string;
  score: number;
};

type KnowledgeRetrieveResponse = {
  results?: KnowledgeRetrieveResult[];
};

type ResolveModalState = {
  open: boolean;
  caseId: string;
  answer: string;
};

type TicketAnswerModalState = {
  open: boolean;
  caseId: string;
  question: string;
  answer: string;
};

type BenchmarkRecord = {
  id: string;
  query: string;
  mode: AssistantMode;
  totalClientMs: number;
  serverTotalMs: number;
  createdAt: string;
};

const USERS_KEY = 'jnpi_users';
const AUTH_KEY = 'jnpi_auth';
const THEME_KEY = 'jnpi_theme';
const GUEST_ID_KEY = 'jnpi_guest_id';
const CHATS_PREFIX = 'jnpi_chats_';
const BENCH_PREFIX = 'jnpi_bench_';
const SEEN_CLOSED_PREFIX = 'jnpi_seen_closed_';

const ADMIN_SEED: StoredUser = {
  id: 'admin-root',
  name: 'Platform Admin',
  email: 'admin@jnpi.local',
  password: 'Admin@12345',
  role: 'admin',
  platformRole: 'system_admin',
};

const modeLabel: Record<AssistantMode, string> = {
  concise: 'سريع',
  detailed: 'تفصيلي',
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getGuestId(): string {
  const existing = localStorage.getItem(GUEST_ID_KEY);
  if (existing) return existing;
  const value = `guest-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(GUEST_ID_KEY, value);
  return value;
}

function ensureUsers(): StoredUser[] {
  const users = readJson<StoredUser[]>(USERS_KEY, []);
  const normalized = users.map((user) => ({
    ...user,
    platformRole: user.platformRole ?? (user.role === 'admin' ? 'system_admin' : 'auditor'),
  }));
  const withAdmin = normalized.some((user) => user.email === ADMIN_SEED.email)
    ? normalized
    : [...normalized, ADMIN_SEED];
  writeJson(USERS_KEY, withAdmin);
  return withAdmin;
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: uid('msg'),
    role: 'system',
    text: 'أهلاً بك في المنصة الوطنية للذكاء الاصطناعي. اطرح سؤالك وسأجيبك مع مصادر موثوقة.',
    createdAt: new Date().toISOString(),
  };
}

function createConversation(ownerId: string): Conversation {
  const now = new Date().toISOString();
  return {
    id: uid('chat'),
    title: 'محادثة جديدة',
    sessionId: `sess-${ownerId}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: now,
    updatedAt: now,
    messages: [createWelcomeMessage()],
  };
}

function relativeTime(date: string): string {
  const value = new Date(date).getTime();
  const diff = Date.now() - value;
  if (diff < 60_000) return 'الآن';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}د`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}س`;
  return `${Math.floor(diff / 86_400_000)}ي`;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function roleLabel(role: Role): string {
  if (role === 'admin') return 'مدير';
  if (role === 'user') return 'مستخدم';
  return 'ضيف';
}

function platformRoleLabel(role: PlatformRole): string {
  if (role === 'system_admin') return 'System Admin';
  if (role === 'ministry_admin_manager') return 'Ministry Admin Manager';
  return 'Auditor';
}

function toAuthRole(platformRole: PlatformRole): Exclude<Role, 'guest'> {
  return platformRole === 'system_admin' ? 'admin' : 'user';
}

function toKnowledgeVisibility(value: 'public' | 'private'): 'public' | 'confidential' {
  return value === 'private' ? 'confidential' : 'public';
}

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getChatStorageKey(ownerId: string): string {
  return `${CHATS_PREFIX}${ownerId}`;
}

function getBenchStorageKey(ownerId: string): string {
  return `${BENCH_PREFIX}${ownerId}`;
}

/**
 * FIX 4 — JNPI-AGENT-004
 * ExplainState renders two interactive elements per assistant message:
 *  1. Clickable confidence badge  → opens ConfidenceResult modal (GET /confidence/{id})
 *  2. "Why this answer?" button   → shows ExplanationResult panel (GET /explain_decision/{id})
 */
function ExplainState({
  messageId,
  metadata,
}: {
  messageId: string;
  metadata: MessageMeta;
}) {
  const [confLoading, setConfLoading] = useState(false);
  const [confData, setConfData] = useState<ConfidenceResult | null>(null);
  const [confError, setConfError] = useState(false);
  const [confOpen, setConfOpen] = useState(false);

  const [explainLoading, setExplainLoading] = useState(false);
  const [explainData, setExplainData] = useState<ExplanationResult | null>(null);
  const [explainError, setExplainError] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  const responseId = metadata.response_id;

  const handleConfidenceClick = async () => {
    if (!responseId) return;
    setConfLoading(true);
    setConfError(false);
    const result = await fetchConfidence(responseId);
    setConfLoading(false);
    if ('error' in result) {
      setConfError(true);
    } else {
      setConfData(result);
      setConfOpen(true);
    }
  };

  const handleExplain = async () => {
    if (!responseId) return;
    setExplainLoading(true);
    setExplainError(false);
    setExplainOpen(false);
    const result = await fetchExplanation(responseId);
    setExplainLoading(false);
    if ('error' in result) {
      setExplainError(true);
    } else {
      setExplainData(result);
      setExplainOpen(true);
    }
  };

  return (
    <>
      {/* Confidence badge — clickable when response_id is available */}
      <button
        id={`confidence-badge-${messageId}`}
        onClick={responseId ? () => void handleConfidenceClick() : undefined}
        className={`rounded-md px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${
          responseId ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700' : 'cursor-default'
        }`}
        title={responseId ? 'انقر لعرض تفاصيل الثقة' : undefined}
        disabled={confLoading}
      >
        {confLoading ? '...' : `الثقة: ${Math.round((metadata.confidence ?? 0) * 100)}%`}
      </button>

      {/* Confidence breakdown modal */}
      {confOpen && confData && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setConfOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm">تفاصيل الثقة</div>
              <button onClick={() => setConfOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-lg leading-none">×</button>
            </div>
            <div className="space-y-2 text-xs">
              {Object.entries(confData.breakdown ?? {}).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">{k}</span>
                  <span className="font-medium">{typeof v === 'number' ? `${Math.round(v * 100)}%` : String(v)}</span>
                </div>
              ))}
              {!Object.keys(confData.breakdown ?? {}).length && (
                <div className="text-slate-500">لا توجد تفاصيل متاحة.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {confError && (
        <span className="text-[10px] text-red-500">Confidence details unavailable.</span>
      )}

      {/* "Why this answer?" button */}
      {responseId && (
        <div className="w-full mt-1">
          <button
            id={`explain-btn-${messageId}`}
            onClick={() => void handleExplain()}
            disabled={explainLoading}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 underline disabled:opacity-50"
          >
            {explainLoading ? 'جارٍ التحميل...' : 'لماذا هذه الإجابة؟'}
          </button>

          {/* Collapsible explanation panel */}
          {explainOpen && explainData && (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs space-y-1">
              <button
                onClick={() => setExplainOpen(false)}
                className="float-left text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 leading-none"
              >
                ×
              </button>
              <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">مسار التوجيه</div>
              <div className="flex justify-between">
                <span className="text-slate-500">النية:</span>
                <span>{explainData.routing_decision.intent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">القطاع:</span>
                <span>{explainData.routing_decision.sector}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">العميل:</span>
                <span>{explainData.routing_decision.agent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ثقة التوجيه:</span>
                <span>{Math.round(explainData.routing_decision.confidence_hint * 100)}%</span>
              </div>
            </div>
          )}

          {explainError && (
            <span className="text-[10px] text-red-500">Explanation unavailable.</span>
          )}
        </div>
      )}
    </>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => getInitialTheme());
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<View>('chat');
  const [adminTab, setAdminTab] = useState<AdminTab>('knowledge');
  const [mode, setMode] = useState<AssistantMode>('concise');
  const [loading, setLoading] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [doc, setDoc] = useState<Citation | null>(null);

  const [knowledgeSources, setKnowledgeSources] = useState<SourceInfo[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestSourceName, setIngestSourceName] = useState('');
  const [ingestTags, setIngestTags] = useState('');
  const [ingestVisibility, setIngestVisibility] = useState<'public' | 'private'>('public');
  const [ingesting, setIngesting] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [sourcePages, setSourcePages] = useState<{ page: number; image_url: string }[]>([]);
  const [selectedSourcePage, setSelectedSourcePage] = useState<number | null>(null);
  const [retrieveQuery, setRetrieveQuery] = useState('');
  const [retrieveResults, setRetrieveResults] = useState<KnowledgeRetrieveResult[]>([]);
  const [retrieveLoading, setRetrieveLoading] = useState(false);

  const [managedUsers, setManagedUsers] = useState<StoredUser[]>([]);
  const [usersReady, setUsersReady] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [manageName, setManageName] = useState('');
  const [manageEmail, setManageEmail] = useState('');
  const [managePassword, setManagePassword] = useState('');
  const [manageRole, setManageRole] = useState<PlatformRole>('auditor');
  const [manageMinistry, setManageMinistry] = useState('');
  const [manageError, setManageError] = useState<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [resolveModal, setResolveModal] = useState<ResolveModalState>({ open: false, caseId: '', answer: '' });
  const [ticketAnswerModal, setTicketAnswerModal] = useState<TicketAnswerModalState>({
    open: false,
    caseId: '',
    question: '',
    answer: '',
  });

  const [auth, setAuth] = useState<AuthState>(() => {
    ensureUsers();
    const saved = readJson<AuthState | null>(AUTH_KEY, null);
    if (saved) return saved;
    const guestId = getGuestId();
    const guest: AuthState = { id: guestId, name: 'Guest User', email: '', role: 'guest', isGuest: true };
    writeJson(AUTH_KEY, guest);
    return guest;
  });

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [benchmarks, setBenchmarks] = useState<BenchmarkRecord[]>([]);
  const [tickets, setTickets] = useState<WorkflowCase[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsFilter, setTicketsFilter] = useState<'all' | 'open' | 'closed'>('all');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    writeJson(AUTH_KEY, auth);
  }, [auth]);

  useEffect(() => {
    const onPopState = (): void => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    setManagedUsers(ensureUsers());
    setUsersReady(true);
  }, []);

  useEffect(() => {
    if (!usersReady) return;
    writeJson(USERS_KEY, managedUsers);
  }, [managedUsers, usersReady]);

  useEffect(() => {
    if (currentPath.startsWith('/admin')) {
      if (auth.role === 'admin') {
        setView('admin');
      } else {
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
        setView('chat');
      }
      return;
    }
    if (view === 'admin' && auth.role !== 'admin') {
      setView('chat');
    }
  }, [currentPath, auth.role, view]);

  useEffect(() => {
    const chatKey = getChatStorageKey(auth.id);
    const found = readJson<Conversation[]>(chatKey, []);
    const initial = found.length ? found : [createConversation(auth.id)];
    setConversations(initial);
    setActiveChatId(initial[0].id);

    const bench = readJson<BenchmarkRecord[]>(getBenchStorageKey(auth.id), []);
    setBenchmarks(bench);
  }, [auth.id]);

  useEffect(() => {
    writeJson(getChatStorageKey(auth.id), conversations);
  }, [auth.id, conversations]);

  useEffect(() => {
    writeJson(getBenchStorageKey(auth.id), benchmarks);
  }, [auth.id, benchmarks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeChatId, loading]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeChatId) ?? conversations[0],
    [activeChatId, conversations],
  );

  const seenClosedKey = `${SEEN_CLOSED_PREFIX}${auth.id}`;
  const seenClosed = readJson<string[]>(seenClosedKey, []);

  const unreadClosed = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'closed' && !seenClosed.includes(ticket.case_id)).length,
    [tickets, seenClosed],
  );

  const appendMessage = (conversationId: string, message: ChatMessage): void => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const messages = [...conversation.messages, message];
        const nextTitle =
          conversation.title === 'محادثة جديدة' && message.role === 'user'
            ? message.text.slice(0, 36)
            : conversation.title;
        return { ...conversation, title: nextTitle, messages, updatedAt: new Date().toISOString() };
      }),
    );
  };

  const addBenchmark = (record: BenchmarkRecord): void => {
    setBenchmarks((prev) => [record, ...prev].slice(0, 100));
  };

  const navigateTo = (nextPath: '/' | '/admin'): void => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setCurrentPath(nextPath);
  };

  const fetchTickets = async (): Promise<void> => {
    setTicketsLoading(true);
    try {
      if (auth.role === 'admin') {
        const response = await fetch('http://localhost:9400/cases?page_size=200');
        const data = (await response.json()) as CasesResponse;
        setTickets(data.cases ?? []);
      } else {
        const all: WorkflowCase[] = [];
        const userResponse = await fetch(`http://localhost:9400/users/${auth.id}/cases?page_size=200`);
        const userData = (await userResponse.json()) as CasesResponse;
        all.push(...(userData.cases ?? []));

        for (const conversation of conversations) {
          const response = await fetch(`http://localhost:9400/users/${conversation.sessionId}/cases?page_size=100`);
          const data = (await response.json()) as CasesResponse;
          all.push(...(data.cases ?? []));
        }
        const unique = Array.from(new Map(all.map((ticket) => [ticket.case_id, ticket])).values());
        setTickets(unique.sort((a, b) => b.created_at.localeCompare(a.created_at)));
      }
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchKnowledgeSources = async (): Promise<void> => {
    setKnowledgeLoading(true);
    setKnowledgeError(null);
    try {
      const response = await fetch('http://localhost:9100/sources');
      const data = (await response.json()) as SourcesResponse;
      setKnowledgeSources((data.sources ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    } catch {
      setKnowledgeError('تعذر تحميل مصادر المعرفة حالياً');
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleIngest = async (): Promise<void> => {
    if (!ingestFile) {
      setKnowledgeError('يرجى اختيار ملف للرفع');
      return;
    }
    setIngesting(true);
    setKnowledgeError(null);
    try {
      const body = new FormData();
      body.append('file', ingestFile);
      body.append('source_name', ingestSourceName.trim() || ingestFile.name);
      body.append('tags', ingestTags.trim());
      body.append('visibility', toKnowledgeVisibility(ingestVisibility));

      const response = await fetch('http://localhost:9100/ingest', {
        method: 'POST',
        body,
      });
      if (!response.ok) {
        throw new Error('ingest_failed');
      }

      setIngestFile(null);
      setIngestSourceName('');
      setIngestTags('');
      await fetchKnowledgeSources();
    } catch {
      setKnowledgeError('فشل رفع المستند، تحقق من الخدمة أو تنسيق الملف');
    } finally {
      setIngesting(false);
    }
  };

  const loadSourcePages = async (sourceId: string, preferredPage?: number): Promise<void> => {
    setSelectedSourceId(sourceId);
    setSelectedSourcePage(null);
    try {
      const response = await fetch(`http://localhost:9100/sources/${sourceId}/pages`);
      const data = (await response.json()) as SourcePagesResponse;
      setSourcePages(data.pages ?? []);
      if (data.pages?.length) {
        const matched = preferredPage ? data.pages.find((pageItem) => pageItem.page === preferredPage) : undefined;
        setSelectedSourcePage(matched ? matched.page : data.pages[0].page);
      }
    } catch {
      setSourcePages([]);
    }
  };

  const runKnowledgeRetrieve = async (): Promise<void> => {
    const query = retrieveQuery.trim();
    if (!query) return;
    setRetrieveLoading(true);
    try {
      const response = await fetch('http://localhost:9100/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          top_k: 8,
          visibility: toKnowledgeVisibility(ingestVisibility),
          source_ids: selectedSourceId ? [selectedSourceId] : undefined,
        }),
      });
      const data = (await response.json()) as KnowledgeRetrieveResponse;
      setRetrieveResults(data.results ?? []);
    } catch {
      setRetrieveResults([]);
    } finally {
      setRetrieveLoading(false);
    }
  };

  const deleteKnowledgeSource = async (sourceId: string): Promise<void> => {
    await fetch(`http://localhost:9100/sources/${sourceId}`, { method: 'DELETE' });
    if (selectedSourceId === sourceId) {
      setSelectedSourceId('');
      setSelectedSourcePage(null);
      setSourcePages([]);
    }
    await fetchKnowledgeSources();
  };

  useEffect(() => {
    if (view !== 'tickets') return;
    void fetchTickets();
    const timer = window.setInterval(() => {
      void fetchTickets();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [view, auth.role, conversations]);

  useEffect(() => {
    if (view !== 'admin' || auth.role !== 'admin') return;
    void fetchTickets();
    const timer = window.setInterval(() => {
      void fetchTickets();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [view, auth.role]);

  useEffect(() => {
    if (view === 'admin' && adminTab === 'knowledge' && auth.role === 'admin') {
      void fetchKnowledgeSources();
    }
  }, [view, adminTab, auth.role]);

  const onNewChat = (): void => {
    const conversation = createConversation(auth.id);
    setConversations((prev) => [conversation, ...prev]);
    setActiveChatId(conversation.id);
    setView('chat');
    navigateTo('/');
    setDoc(null);
    setInput('');
  };

  const sendQuery = async (forcedText?: string): Promise<void> => {
    if (!activeConversation) return;
    const text = (forcedText ?? input).trim();
    if (!text) return;

    const startedAt = performance.now();
    setInput('');
    appendMessage(activeConversation.id, {
      id: uid('msg'),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    });
    setLoading(true);

    try {
      const userType = auth.role === 'admin' ? 'employee' : auth.role;

      // Create a temporary message ID for the streaming response
      const assistantMsgId = uid('msg');
      let streamedText = '';
      let metadata: MessageMeta = {};
      let streamChunkEvents = 0;
      let firstChunkAt: number | null = null;

      const mergeCitations = (existing: Citation[] = [], incoming: Citation[] = []): Citation[] => {
        const map = new Map<string, Citation>();
        for (const c of existing) {
          map.set(`${c.source_id}-${c.page}`, c);
        }
        for (const c of incoming) {
          map.set(`${c.source_id}-${c.page}`, c);
        }
        return Array.from(map.values());
      };

      // Set streaming state
      setStreamingMessageId(assistantMsgId);

      // Use streaming endpoint
      const response = await fetch('http://localhost:9200/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          user_type: userType,
          user_id: auth.id,
          mode,
          session_id: activeConversation.sessionId,
          language: 'ar',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      // Add empty assistant message that we'll update as chunks arrive
      appendMessage(activeConversation.id, {
        id: assistantMsgId,
        role: 'assistant',
        text: '',
        createdAt: new Date().toISOString(),
        metadata: {},
      });

      let buffer = '';

      const processEvent = (rawEvent: string) => {
        if (!rawEvent.trim()) return;

        let eventType = 'message';
        const dataLines: string[] = [];

        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.substring(5).trim());
          }
        }

        const dataStr = dataLines.join('\n').trim();
        if (!dataStr) return;

        try {
          const data = JSON.parse(dataStr);

          if (eventType === 'chunk' && data.text !== undefined) {
            streamedText += data.text;
            streamChunkEvents += 1;
            if (firstChunkAt === null) firstChunkAt = performance.now();

            metadata = {
              ...metadata,
              totalClientMs: performance.now() - startedAt,
              firstTokenMs: firstChunkAt - startedAt,
              streamChunkEvents,
            };

            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === activeConversation.id
                  ? {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: streamedText, metadata }
                          : msg
                      ),
                    }
                  : conv
              )
            );
            return;
          }

          if (eventType === 'citation') {
            metadata = {
              ...metadata,
              citations: mergeCitations(metadata.citations, [data as Citation]),
            };

            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === activeConversation.id
                  ? {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, metadata }
                          : msg
                      ),
                    }
                  : conv
              )
            );
            return;
          }

          if (eventType === 'complete' || data.confidence !== undefined) {
            const totalClientMs = performance.now() - startedAt;
            const serverTotalMs = (data.timings?.total ?? 0) * 1000;
            const displayTotalMs = serverTotalMs > 0 ? serverTotalMs : totalClientMs;

            metadata = {
              ...metadata,
              confidence: data.confidence,
              citations: mergeCitations(metadata.citations, data.citations || []),
              escalated: data.escalated,
              escalation_reason: data.escalation_reason,
              escalation_confirmation_required: data.escalation_confirmation_required,
              totalClientMs: displayTotalMs,
              firstTokenMs: firstChunkAt !== null ? firstChunkAt - startedAt : undefined,
              streamChunkEvents,
              chunks_used: data.chunks_used,
              timings: data.timings,
              // FIX 3 — capture new agent-service response fields
              agent_used: data.agent_used,
              sector: data.sector,
              has_amendments: data.has_amendments,
              amendment_note: data.amendment_note,
              session_id: data.session_id,
              response_id: data.response_id,
            };

            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === activeConversation.id
                  ? {
                      ...conv,
                      messages: conv.messages.map((msg) =>
                        msg.id === assistantMsgId
                          ? { ...msg, text: streamedText, metadata }
                          : msg
                      ),
                    }
                  : conv
              )
            );

            addBenchmark({
              id: uid('bench'),
              query: text,
              mode,
              totalClientMs,
              serverTotalMs,
              createdAt: new Date().toISOString(),
            });
            return;
          }

          if (eventType === 'error' || data.error) {
            appendMessage(activeConversation.id, {
              id: uid('msg'),
              role: 'system',
              text: `خطأ: ${data.error || 'Unknown stream error'}`,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', dataStr, e);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          processEvent(rawEvent);
        }
      }

      if (buffer.trim()) {
        processEvent(buffer);
      }

      // Clear streaming state
      setStreamingMessageId(null);
    } catch (error) {
      console.error('Streaming error:', error);
      appendMessage(activeConversation.id, {
        id: uid('msg'),
        role: 'system',
        text: 'تعذر الاتصال بالخادم حالياً.',
        createdAt: new Date().toISOString(),
      });
      setStreamingMessageId(null);
    } finally {
      setLoading(false);
    }
  };

  const migrateGuestData = (targetUserId: string): void => {
    if (!auth.isGuest) return;
    const guestChats = readJson<Conversation[]>(getChatStorageKey(auth.id), []);
    const targetChats = readJson<Conversation[]>(getChatStorageKey(targetUserId), []);
    const merged = [...guestChats, ...targetChats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    writeJson(getChatStorageKey(targetUserId), merged);

    const guestBench = readJson<BenchmarkRecord[]>(getBenchStorageKey(auth.id), []);
    const targetBench = readJson<BenchmarkRecord[]>(getBenchStorageKey(targetUserId), []);
    writeJson(getBenchStorageKey(targetUserId), [...guestBench, ...targetBench]);
  };

  const signIn = (): void => {
    const users = managedUsers.length ? managedUsers : ensureUsers();
    const user = users.find(
      (item) => item.email === authEmail.trim().toLowerCase() && item.password === authPassword,
    );
    if (!user) {
      setAuthError('بيانات الدخول غير صحيحة');
      return;
    }
    migrateGuestData(user.id);
    setAuth({ id: user.id, name: user.name, email: user.email, role: user.role, isGuest: false });
    if (user.role === 'admin') {
      setView('admin');
      navigateTo('/admin');
    } else {
      setView('chat');
      navigateTo('/');
    }
    setShowAuthModal(false);
    setAuthError(null);
    setAuthEmail('');
    setAuthPassword('');
  };

  const signUp = (): void => {
    const name = authName.trim();
    const email = authEmail.trim().toLowerCase();
    if (!name || !email || authPassword.length < 6) {
      setAuthError('يرجى إدخال اسم وبريد صحيحين وكلمة مرور 6 أحرف على الأقل');
      return;
    }
    const users = managedUsers.length ? managedUsers : ensureUsers();
    if (users.some((user) => user.email === email)) {
      setAuthError('هذا البريد مسجل مسبقاً');
      return;
    }

    const newUser: StoredUser = {
      id: uid('user'),
      name,
      email,
      password: authPassword,
      role: 'user',
      platformRole: 'auditor',
    };

    const updated = [...users, newUser];
    setManagedUsers(updated);
    writeJson(USERS_KEY, updated);
    migrateGuestData(newUser.id);
    setAuth({ id: newUser.id, name: newUser.name, email: newUser.email, role: 'user', isGuest: false });
    setView('chat');
    navigateTo('/');
    setShowAuthModal(false);
    setAuthError(null);
    setAuthName('');
    setAuthEmail('');
    setAuthPassword('');
  };

  const signOut = (): void => {
    const guestId = getGuestId();
    const guest: AuthState = { id: guestId, name: 'Guest User', email: '', role: 'guest', isGuest: true };
    setAuth(guest);
    setView('chat');
    navigateTo('/');
    setDoc(null);
  };

  const resetManageForm = (): void => {
    setEditingUserId(null);
    setManageName('');
    setManageEmail('');
    setManagePassword('');
    setManageRole('auditor');
    setManageMinistry('');
    setManageError(null);
  };

  const saveManagedUser = (): void => {
    const name = manageName.trim();
    const email = manageEmail.trim().toLowerCase();
    if (!name || !email || (!editingUserId && managePassword.length < 6)) {
      setManageError('أدخل الاسم والبريد وكلمة مرور لا تقل عن 6 أحرف');
      return;
    }

    if (managedUsers.some((user) => user.email === email && user.id !== editingUserId)) {
      setManageError('البريد مستخدم بالفعل');
      return;
    }

    if (editingUserId) {
      setManagedUsers((prev) =>
        prev.map((user) => {
          if (user.id !== editingUserId) return user;
          const updated: StoredUser = {
            ...user,
            name,
            email,
            role: toAuthRole(manageRole),
            platformRole: manageRole,
            ministry: manageMinistry.trim() || undefined,
            password: managePassword ? managePassword : user.password,
          };
          return updated;
        }),
      );
      if (auth.id === editingUserId) {
        setAuth((prev) => ({ ...prev, name, email, role: toAuthRole(manageRole) }));
      }
    } else {
      const created: StoredUser = {
        id: uid('user'),
        name,
        email,
        password: managePassword,
        role: toAuthRole(manageRole),
        platformRole: manageRole,
        ministry: manageMinistry.trim() || undefined,
      };
      setManagedUsers((prev) => [created, ...prev]);
    }

    resetManageForm();
  };

  const startEditManagedUser = (user: StoredUser): void => {
    setEditingUserId(user.id);
    setManageName(user.name);
    setManageEmail(user.email);
    setManagePassword('');
    setManageRole(user.platformRole);
    setManageMinistry(user.ministry ?? '');
    setManageError(null);
  };

  const removeManagedUser = (userId: string): void => {
    if (userId === auth.id) {
      setManageError('لا يمكن حذف المستخدم الحالي');
      return;
    }
    setManagedUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  const filteredTickets = useMemo(() => {
    if (ticketsFilter === 'all') return tickets;
    if (ticketsFilter === 'open') return tickets.filter((ticket) => ticket.status !== 'closed');
    return tickets.filter((ticket) => ticket.status === 'closed');
  }, [tickets, ticketsFilter]);

  const markInboxSeen = (): void => {
    const resolved = tickets.filter((ticket) => ticket.status === 'closed').map((ticket) => ticket.case_id);
    writeJson(seenClosedKey, Array.from(new Set([...seenClosed, ...resolved])));
    setTickets((prev) => [...prev]);
  };

  const openResolveModal = (caseId: string): void => {
    setResolveModal({ open: true, caseId, answer: '' });
  };

  const closeResolveModal = (): void => {
    setResolveModal({ open: false, caseId: '', answer: '' });
  };

  const openTicketAnswerModal = (ticket: WorkflowCase): void => {
    setTicketAnswerModal({
      open: true,
      caseId: ticket.case_id,
      question: ticket.query,
      answer: ticket.resolution_answer ?? '',
    });
  };

  const closeTicketAnswerModal = (): void => {
    setTicketAnswerModal({ open: false, caseId: '', question: '', answer: '' });
  };

  const submitResolve = async (): Promise<void> => {
    if (!resolveModal.caseId || !resolveModal.answer.trim()) return;
    await fetch(`http://localhost:9400/cases/${resolveModal.caseId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: auth.name,
        resolution_answer: resolveModal.answer.trim(),
        resolution_note: 'resolved from admin modal',
      }),
    });
    closeResolveModal();
    await fetchTickets();
  };

  const avgLatency = useMemo(() => {
    if (!benchmarks.length) return 0;
    return benchmarks.reduce((sum, item) => sum + item.totalClientMs, 0) / benchmarks.length;
  }, [benchmarks]);

  const ministryInsights = useMemo(() => {
    const map = new Map<string, { total: number; open: number; closed: number; urgent: number }>();
    for (const ticket of tickets) {
      const ministry = ticket.sector_primary || 'غير محدد';
      const current = map.get(ministry) ?? { total: 0, open: 0, closed: 0, urgent: 0 };
      current.total += 1;
      if (ticket.status === 'closed') current.closed += 1;
      else current.open += 1;
      if (ticket.priority === 'urgent') current.urgent += 1;
      map.set(ministry, current);
    }
    return Array.from(map.entries())
      .map(([ministry, stats]) => ({ ministry, ...stats }))
      .sort((a, b) => b.total - a.total);
  }, [tickets]);

  const roleStats = useMemo(() => {
    const counts: Record<PlatformRole, number> = {
      auditor: 0,
      ministry_admin_manager: 0,
      system_admin: 0,
    };
    for (const user of managedUsers) {
      counts[user.platformRole] += 1;
    }
    return counts;
  }, [managedUsers]);

  const selectedSource = useMemo(
    () => knowledgeSources.find((source) => source.source_id === selectedSourceId) ?? null,
    [knowledgeSources, selectedSourceId],
  );

  return (
    <div className="h-screen w-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex overflow-hidden" dir="rtl">
      <aside
        className={`border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col overflow-hidden transition-[width] duration-200 ${
          sidebarOpen ? 'w-72' : 'w-16'
        }`}
      >
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            onClick={onNewChat}
            className={`rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm px-3 py-2 flex items-center gap-2 ${
              sidebarOpen ? 'flex-1 justify-center' : 'w-10 justify-center'
            }`}
          >
            <Plus size={16} />
            {sidebarOpen && 'محادثة جديدة'}
          </button>
          <button
            onClick={() => setSidebarOpen((value) => !value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {sidebarOpen && (
          <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-xs">
            <div className="text-slate-500 dark:text-slate-400">الحساب الحالي</div>
            <div className="font-semibold mt-1">{auth.name}</div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">{roleLabel(auth.role)}</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-1 chat-scroll">
          {sidebarOpen ? (
            conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => {
                  setActiveChatId(conversation.id);
                  setView('chat');
                  navigateTo('/');
                }}
                className={`w-full text-right rounded-lg px-3 py-2 text-sm transition-colors ${
                  activeChatId === conversation.id
                    ? 'bg-slate-200 dark:bg-slate-800 font-semibold'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                <div className="truncate">{conversation.title}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{relativeTime(conversation.updatedAt)}</div>
              </button>
            ))
          ) : (
            <div className="h-full flex items-start justify-center pt-2 text-slate-400 dark:text-slate-500">
              <MessageSquareText size={16} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 p-2 space-y-1">
          <button
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            className="w-full rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-2"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {sidebarOpen && (theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن')}
          </button>
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center gap-2"
          >
            {auth.isGuest ? <LogIn size={15} /> : <User size={15} />}
            {sidebarOpen && (auth.isGuest ? 'تسجيل دخول / إنشاء حساب' : 'الحساب')}
          </button>
          {!auth.isGuest && (
            <button
              onClick={signOut}
              className="w-full rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2"
            >
              <LogOut size={15} />
              {sidebarOpen && 'تسجيل الخروج'}
            </button>
          )}

          {auth.isGuest && sidebarOpen && (
            <div className="mt-2 rounded-lg border border-amber-300/70 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-200 text-xs px-3 py-2 flex items-center gap-1">
              <Lock size={12} /> Guest Mode: التصعيد يتطلب تسجيل الدخول
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="font-semibold text-sm">Jordan Vision Assistant</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Production-ready chat + ticket workflow</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setView('chat');
                navigateTo('/');
              }}
              className={`px-3 py-1.5 rounded-md text-xs md:text-sm ${view === 'chat' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              المحادثة
            </button>
            {!auth.isGuest && (
              <button
                onClick={() => {
                  setView('tickets');
                  navigateTo('/');
                }}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm flex items-center gap-1 ${
                  view === 'tickets' ? 'bg-amber-500 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Ticket size={14} />
                {auth.role === 'admin' ? 'التذاكر' : 'صندوق التذاكر'}
                {auth.role !== 'admin' && unreadClosed > 0 && (
                  <span className="bg-red-600 text-white rounded-full text-[10px] px-1.5 py-0.5">{unreadClosed}</span>
                )}
              </button>
            )}
            {auth.role === 'admin' && (
              <button
                onClick={() => {
                  setView('admin');
                  navigateTo('/admin');
                }}
                className={`px-3 py-1.5 rounded-md text-xs md:text-sm flex items-center gap-1 ${
                  view === 'admin' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <LayoutDashboard size={14} /> الإدارة
              </button>
            )}
          </div>
        </header>

        {view === 'chat' && (
          <section className="flex-1 flex overflow-hidden bg-slate-100 dark:bg-slate-900">
            <div className={`flex flex-col ${doc ? 'w-1/2' : 'w-full'}`}>
              <div className="h-12 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between bg-white dark:bg-slate-950">
                <div className="flex gap-2">
                  <button
                    onClick={() => setMode('concise')}
                    className={`px-3 py-1 text-xs rounded-md ${mode === 'concise' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    سريع
                  </button>
                  <button
                    onClick={() => setMode('detailed')}
                    className={`px-3 py-1 text-xs rounded-md ${mode === 'detailed' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    تفصيلي
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Session: {activeConversation?.sessionId}</div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 chat-scroll">
                {activeConversation?.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] md:max-w-[78%] rounded-2xl border px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-slate-900 text-white border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    }`}>
                      {message.role === 'user' ? (
                        <div className="text-sm leading-7 whitespace-pre-wrap text-white dark:text-slate-100">{message.text}</div>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-100">
                          <ReactMarkdown>{message.text}</ReactMarkdown>
                          {streamingMessageId === message.id && (
                            <span className="inline-block w-2 h-4 bg-emerald-600 ml-1 animate-pulse" style={{ animationDuration: '0.8s' }} />
                          )}
                        </div>
                      )}

                      {message.metadata && (
                        <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-700/70 space-y-2">
                          <div className="flex flex-wrap gap-2 text-[11px]">
                            {message.metadata.confidence !== undefined && (
                              // FIX 4 — confidence badge is now clickable to open breakdown drawer
                              <ExplainState messageId={message.id} metadata={message.metadata} />
                            )}
                            {message.metadata.totalClientMs !== undefined && (
                              <span className="rounded-md px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">الزمن: {formatMs(message.metadata.totalClientMs)}</span>
                            )}
                            {message.metadata.chunks_used !== undefined && (
                              <span className="rounded-md px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">المقاطع: {message.metadata.chunks_used}</span>
                            )}
                            {message.metadata.escalated && (
                              <span className="rounded-md px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">تم التصعيد</span>
                            )}
                            {/* FIX 3 — Agent badge */}
                            {message.metadata.agent_used && (
                              <span className="rounded-md px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                                🤖 {message.metadata.agent_used}
                              </span>
                            )}
                            {/* FIX 3 — Sector tag */}
                            {message.metadata.sector && (
                              <span className="rounded-md px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                📂 {message.metadata.sector}
                              </span>
                            )}
                          </div>

                          {/* FIX 3 — Amendment warning box */}
                          {message.metadata.has_amendments && (
                            <div className="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                              <span className="shrink-0 mt-0.5">⚠️</span>
                              <span>
                                {message.metadata.amendment_note ||
                                  'This policy document has known amendments. Verify against the latest official version.'}
                              </span>
                            </div>
                          )}

                          {message.metadata.escalation_confirmation_required && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-1"><Lock size={13} /> تأكيد التصعيد مطلوب</div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => void sendQuery('نعم')}
                                  disabled={loading}
                                  className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                >نعم</button>
                                <button
                                  onClick={() => void sendQuery('لا')}
                                  disabled={loading}
                                  className="px-3 py-1.5 rounded border bg-white dark:bg-slate-900"
                                >لا</button>
                              </div>
                            </div>
                          )}

                          {/* FIX 5 — Enhanced citation cards */}
                          {!!message.metadata.citations?.length && (
                            <div className="flex flex-wrap gap-2">
                              {message.metadata.citations.map((citation) => (
                                <button
                                  key={`${citation.source_id}-${citation.page}`}
                                  onClick={() => setDoc(citation)}
                                  className="text-xs rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800 flex flex-col items-start gap-0.5 text-right"
                                >
                                  <span className="flex items-center gap-1">
                                    <FileText size={12} />
                                    {/* FIX 5 — show document_year next to source_name */}
                                    {citation.source_name}
                                    {citation.document_year != null && (
                                      <span className="text-slate-500 dark:text-slate-400">({citation.document_year})</span>
                                    )}
                                    {/* FIX 5 — Amendment badge */}
                                    {citation.is_amendment && (
                                      <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold">تعديل</span>
                                    )}
                                  </span>
                                  <span className="text-slate-500 dark:text-slate-400">ص {citation.page}</span>
                                  {/* FIX 5 — Relevance score bar */}
                                  {citation.relevance_score !== undefined && citation.relevance_score > 0 && (
                                    <span className="w-full flex items-center gap-1 mt-0.5">
                                      <span className="text-[9px] text-slate-400">صلة:</span>
                                      <span className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                        <span
                                          className="h-full block rounded-full bg-emerald-500"
                                          style={{ width: `${Math.round(citation.relevance_score * 100)}%` }}
                                        />
                                      </span>
                                      <span className="text-[9px] text-slate-400">{Math.round(citation.relevance_score * 100)}%</span>
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* FIX 3 — Ref ID audit line */}
                          {(message.metadata.response_id || message.metadata.session_id) && (
                            <div className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">
                              Ref: {message.metadata.response_id ?? '—'} · Session: {message.metadata.session_id ?? '—'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && <div className="text-xs text-slate-500 dark:text-slate-400">جاري توليد الإجابة...</div>}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendQuery();
                  }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="relative">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="اكتب سؤالك هنا..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 px-4 py-3 pl-12 outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !input.trim()}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-emerald-600 text-white disabled:bg-slate-300 flex items-center justify-center"
                    >
                      <Send size={14} className="rotate-180" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {doc && (
              <div className="w-1/2 border-r border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 flex flex-col">
                <div className="h-12 bg-slate-900 text-white px-4 flex items-center justify-between">
                  <div className="text-sm truncate">{doc.source_name}</div>
                  <button onClick={() => setDoc(null)} className="text-xs underline">إغلاق</button>
                </div>
                <div className="flex-1 p-4 overflow-auto">
                  <img
                    src={`http://localhost:9100/sources/${doc.source_id}/page/${doc.page}`}
                    alt={doc.source_name}
                    className="w-full rounded border bg-white"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {view === 'tickets' && (
          <section className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-900 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{auth.role === 'admin' ? 'لوحة التذاكر الإدارية' : 'صندوق التذاكر'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {auth.role === 'admin' ? 'إدارة وتصنيف وردّ التذاكر' : 'تابع تذاكرك المجابة وغير المجابة'}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void fetchTickets()} className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1"><RefreshCw size={13} /> تحديث</button>
                {auth.role !== 'admin' && (
                  <button onClick={markInboxSeen} className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1"><Bell size={13} /> تعليم كمقروء</button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {(['all', 'open', 'closed'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setTicketsFilter(value)}
                  className={`px-3 py-1.5 rounded-md text-xs ${ticketsFilter === value ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800'}`}
                >
                  {value === 'all' ? 'الكل' : value === 'open' ? 'غير مجاب' : 'مجاب'}
                </button>
              ))}
            </div>

            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {ticketsLoading ? (
                <div className="p-5 text-sm text-slate-500">جاري تحميل التذاكر...</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="p-3 text-right">رقم</th>
                      <th className="p-3 text-right">السؤال</th>
                      <th className="p-3 text-right">الحالة</th>
                      <th className="p-3 text-right">الأولوية</th>
                      <th className="p-3 text-right">السبب</th>
                      <th className="p-3 text-right">الرد</th>
                      <th className="p-3 text-right">الوقت</th>
                      {auth.role === 'admin' && <th className="p-3 text-right">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.case_id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="p-3 text-xs font-mono">{ticket.case_id}</td>
                        <td className="p-3 max-w-[360px] truncate" title={ticket.query}>{ticket.query}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${ticket.status === 'closed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : ticket.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{ticket.status}</span>
                        </td>
                        <td className="p-3">{ticket.priority}</td>
                        <td className="p-3">{ticket.escalation_reason}</td>
                        <td className="p-3 max-w-[360px]">
                          {ticket.status === 'closed' && ticket.resolution_answer ? (
                            <div className="flex items-center gap-2">
                              <div className="text-xs leading-6 whitespace-pre-wrap line-clamp-1" title={ticket.resolution_answer}>{ticket.resolution_answer}</div>
                              <button
                                onClick={() => openTicketAnswerModal(ticket)}
                                className="px-2 py-1 rounded-md border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/20 text-[11px] shrink-0"
                              >
                                عرض الرد
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-500 dark:text-slate-400">{new Date(ticket.created_at).toLocaleString('ar-JO')}</td>
                        {auth.role === 'admin' && (
                          <td className="p-3">
                            {ticket.status !== 'closed' ? (
                              <button
                                onClick={() => openResolveModal(ticket.case_id)}
                                className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              >
                                رد
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">مغلق</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {!filteredTickets.length && (
                      <tr>
                        <td colSpan={auth.role === 'admin' ? 8 : 7} className="p-6 text-center text-slate-500 dark:text-slate-400">لا توجد تذاكر في هذا القسم.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {view === 'admin' && auth.role === 'admin' && (
          <section className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-slate-900 space-y-4">
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Admin Control Plane</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">إدارة المعرفة، المستخدمين، وتحليلات الوزارات</div>
                </div>
                <button onClick={() => void fetchTickets()} className="px-3 py-2 rounded-lg border text-xs flex items-center gap-1"><RefreshCw size={13} /> تحديث المؤشرات</button>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={() => setAdminTab('knowledge')}
                  className={`px-3 py-2 rounded-md text-xs flex items-center gap-1 ${adminTab === 'knowledge' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                >
                  <Database size={13} /> Knowledge Hub
                </button>
                <button
                  onClick={() => setAdminTab('users')}
                  className={`px-3 py-2 rounded-md text-xs flex items-center gap-1 ${adminTab === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                >
                  <Users size={13} /> Users & Roles
                </button>
                <button
                  onClick={() => setAdminTab('ministries')}
                  className={`px-3 py-2 rounded-md text-xs flex items-center gap-1 ${adminTab === 'ministries' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                >
                  <Building2 size={13} /> Ministries Insights
                </button>
              </div>
            </div>

            {adminTab === 'knowledge' && (
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-1 space-y-4">
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="font-semibold text-sm">Ingestion</div>
                    <input
                      type="file"
                      onChange={(event) => setIngestFile(event.target.files?.[0] ?? null)}
                      className="w-full text-xs file:rounded-md file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:px-2 file:py-1"
                    />
                    <input
                      value={ingestSourceName}
                      onChange={(event) => setIngestSourceName(event.target.value)}
                      placeholder="اسم المصدر"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                    <input
                      value={ingestTags}
                      onChange={(event) => setIngestTags(event.target.value)}
                      placeholder="وسوم (comma separated)"
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIngestVisibility('public')}
                        className={`flex-1 px-3 py-2 rounded-md text-xs ${ingestVisibility === 'public' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                      >Public</button>
                      <button
                        onClick={() => setIngestVisibility('private')}
                        className={`flex-1 px-3 py-2 rounded-md text-xs ${ingestVisibility === 'private' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                      >Private</button>
                    </div>
                    <button
                      onClick={() => void handleIngest()}
                      disabled={ingesting}
                      className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm flex items-center justify-center gap-1 disabled:opacity-60"
                    >
                      <Upload size={14} /> {ingesting ? 'جاري الرفع...' : 'رفع المستند'}
                    </button>
                    {knowledgeError && <div className="text-xs text-red-600">{knowledgeError}</div>}
                  </div>

                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="font-semibold text-sm">Knowledge Retrieval</div>
                    <div className="flex gap-2">
                      <input
                        value={retrieveQuery}
                        onChange={(event) => setRetrieveQuery(event.target.value)}
                        placeholder="استعلام الاسترجاع"
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                      />
                      <button onClick={() => void runKnowledgeRetrieve()} className="px-3 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white"><Search size={14} /></button>
                    </div>
                    {retrieveLoading && <div className="text-xs text-slate-500">جاري الاسترجاع...</div>}
                    <div className="max-h-48 overflow-y-auto space-y-2 chat-scroll">
                      {retrieveResults.map((item) => (
                        <button
                          key={item.chunk_id}
                          onClick={() => {
                            void loadSourcePages(item.source_id, item.page);
                          }}
                          className="w-full text-right rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900"
                        >
                          <div className="font-semibold truncate">{item.source_name} · ص {item.page}</div>
                          <div className="text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{item.text}</div>
                        </button>
                      ))}
                      {!retrieveLoading && !retrieveResults.length && <div className="text-xs text-slate-500">لا توجد نتائج بعد.</div>}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="font-semibold text-sm">Document Browser</div>
                      <button onClick={() => void fetchKnowledgeSources()} className="px-2 py-1 rounded border text-xs">تحديث</button>
                    </div>

                    {knowledgeLoading ? (
                      <div className="p-4 text-sm text-slate-500">جاري تحميل المصادر...</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                          <tr>
                            <th className="p-2 text-right">المصدر</th>
                            <th className="p-2 text-right">التصنيف</th>
                            <th className="p-2 text-right">المقاطع</th>
                            <th className="p-2 text-right">آخر تحديث</th>
                            <th className="p-2 text-right">إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {knowledgeSources.map((source) => (
                            <tr key={source.source_id} className="border-t border-slate-200 dark:border-slate-800">
                              <td className="p-2">
                                <button onClick={() => void loadSourcePages(source.source_id)} className="text-right hover:underline">
                                  <div className="font-medium">{source.source_name}</div>
                                  <div className="text-xs text-slate-500">{source.filename}</div>
                                </button>
                              </td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${source.visibility === 'public' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                  {source.visibility === 'public' ? 'Public' : 'Private'}
                                </span>
                              </td>
                              <td className="p-2">{source.total_chunks}</td>
                              <td className="p-2 text-xs">{new Date(source.updated_at).toLocaleString('ar-JO')}</td>
                              <td className="p-2">
                                <button onClick={() => void deleteKnowledgeSource(source.source_id)} className="px-2 py-1 rounded bg-red-600 text-white text-xs flex items-center gap-1"><Trash2 size={12} /> حذف</button>
                              </td>
                            </tr>
                          ))}
                          {!knowledgeSources.length && (
                            <tr>
                              <td colSpan={5} className="p-5 text-center text-slate-500">لا توجد مصادر معرفة بعد.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="font-semibold text-sm mb-3">Document Viewer</div>
                    {selectedSource && selectedSourcePage ? (
                      <div>
                        <div className="text-xs text-slate-500 mb-2">{selectedSource.source_name} — صفحة {selectedSourcePage}</div>
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {sourcePages.map((pageItem) => (
                            <button
                              key={pageItem.page}
                              onClick={() => setSelectedSourcePage(pageItem.page)}
                              className={`px-2 py-1 rounded text-xs ${selectedSourcePage === pageItem.page ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-900'}`}
                            >
                              ص {pageItem.page}
                            </button>
                          ))}
                        </div>
                        <img
                          src={`http://localhost:9100/sources/${selectedSource.source_id}/page/${selectedSourcePage}`}
                          alt={selectedSource.source_name}
                          className="w-full rounded border border-slate-200 dark:border-slate-800 bg-white"
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">اختر مصدراً لعرض الصفحات.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'users' && (
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="font-semibold text-sm">{editingUserId ? 'تعديل المستخدم' : 'إضافة مستخدم'}</div>
                  <input value={manageName} onChange={(event) => setManageName(event.target.value)} placeholder="الاسم" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                  <input value={manageEmail} onChange={(event) => setManageEmail(event.target.value)} placeholder="البريد الإلكتروني" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                  <input value={managePassword} onChange={(event) => setManagePassword(event.target.value)} placeholder={editingUserId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
                  <select value={manageRole} onChange={(event) => setManageRole(event.target.value as PlatformRole)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
                    <option value="auditor">Auditor</option>
                    <option value="ministry_admin_manager">Ministry Admin Manager</option>
                    <option value="system_admin">System Admin</option>
                  </select>
                  <input value={manageMinistry} onChange={(event) => setManageMinistry(event.target.value)} placeholder="الوزارة (اختياري)" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />

                  {manageError && <div className="text-xs text-red-600">{manageError}</div>}

                  <div className="flex gap-2">
                    <button onClick={saveManagedUser} className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm">{editingUserId ? 'حفظ' : 'إنشاء'}</button>
                    {editingUserId && <button onClick={resetManageForm} className="px-3 py-2 rounded-lg border text-sm">إلغاء</button>}
                  </div>
                </div>

                <div className="xl:col-span-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="font-semibold text-sm">Users & Role Assignment</div>
                    <div className="text-xs text-slate-500">{managedUsers.length} مستخدم</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-200 dark:border-slate-800 text-xs">
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-2">Auditor: {roleStats.auditor}</div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-2">Ministry Admin: {roleStats.ministry_admin_manager}</div>
                    <div className="rounded-lg bg-slate-100 dark:bg-slate-900 p-2">System Admin: {roleStats.system_admin}</div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2 text-right">الاسم</th>
                        <th className="p-2 text-right">البريد</th>
                        <th className="p-2 text-right">الدور</th>
                        <th className="p-2 text-right">الوزارة</th>
                        <th className="p-2 text-right">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedUsers.map((user) => (
                        <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="p-2">{user.name}</td>
                          <td className="p-2 text-xs">{user.email}</td>
                          <td className="p-2 text-xs">{platformRoleLabel(user.platformRole)}</td>
                          <td className="p-2 text-xs">{user.ministry || '—'}</td>
                          <td className="p-2">
                            <div className="flex gap-2">
                              <button onClick={() => startEditManagedUser(user)} className="px-2 py-1 rounded border text-xs">تعديل</button>
                              <button onClick={() => removeManagedUser(user.id)} className="px-2 py-1 rounded bg-red-600 text-white text-xs">حذف</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminTab === 'ministries' && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">متوسط زمن الاستجابة</div>
                    <div className="text-2xl font-bold mt-1">{formatMs(avgLatency)}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي التذاكر</div>
                    <div className="text-2xl font-bold mt-1">{tickets.length}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">التذاكر المفتوحة</div>
                    <div className="text-2xl font-bold mt-1">{tickets.filter((ticket) => ticket.status !== 'closed').length}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">التذاكر العاجلة</div>
                    <div className="text-2xl font-bold mt-1">{tickets.filter((ticket) => ticket.priority === 'urgent').length}</div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 font-semibold text-sm">Ministry Workload Insights</div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2 text-right">الوزارة / القطاع</th>
                        <th className="p-2 text-right">إجمالي</th>
                        <th className="p-2 text-right">مفتوح</th>
                        <th className="p-2 text-right">مغلق</th>
                        <th className="p-2 text-right">عاجل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ministryInsights.map((item) => (
                        <tr key={item.ministry} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="p-2">{item.ministry}</td>
                          <td className="p-2">{item.total}</td>
                          <td className="p-2">{item.open}</td>
                          <td className="p-2">{item.closed}</td>
                          <td className="p-2">{item.urgent}</td>
                        </tr>
                      ))}
                      {!ministryInsights.length && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500">لا توجد بيانات قطاعات بعد.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 font-semibold text-sm">سجل الأداء</div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2 text-right">الوقت</th>
                        <th className="p-2 text-right">الاستعلام</th>
                        <th className="p-2 text-right">النمط</th>
                        <th className="p-2 text-right">إجمالي</th>
                        <th className="p-2 text-right">داخل الخدمات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarks.map((item) => (
                        <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800">
                          <td className="p-2 text-xs">{new Date(item.createdAt).toLocaleTimeString('ar-JO')}</td>
                          <td className="p-2 max-w-[360px] truncate" title={item.query}>{item.query}</td>
                          <td className="p-2">{modeLabel[item.mode]}</td>
                          <td className="p-2">{formatMs(item.totalClientMs)}</td>
                          <td className="p-2">{formatMs(item.serverTotalMs)}</td>
                        </tr>
                      ))}
                      {!benchmarks.length && (
                        <tr>
                          <td colSpan={5} className="p-5 text-center text-slate-500 dark:text-slate-400">لا توجد بيانات أداء بعد.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {showAuthModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold">{authMode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'}</div>
              <button onClick={() => setShowAuthModal(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setAuthMode('signin')} className={`py-2 rounded text-sm ${authMode === 'signin' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}><LogIn size={14} className="inline ml-1" /> دخول</button>
              <button onClick={() => setAuthMode('signup')} className={`py-2 rounded text-sm ${authMode === 'signup' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}><UserPlus size={14} className="inline ml-1" /> حساب جديد</button>
            </div>

            {authMode === 'signup' && (
              <input
                value={authName}
                onChange={(event) => setAuthName(event.target.value)}
                placeholder="الاسم"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 mb-3 text-sm"
              />
            )}

            <input
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="البريد الإلكتروني"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 mb-3 text-sm"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="كلمة المرور"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 mb-3 text-sm"
            />

            {authError && <div className="text-xs text-red-600 mb-3">{authError}</div>}

            <button
              onClick={authMode === 'signin' ? signIn : signUp}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              {authMode === 'signin' ? 'دخول' : 'إنشاء الحساب'}
            </button>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 border-t border-slate-200 dark:border-slate-800 pt-3">
              Admin credentials: <span className="font-semibold">admin@jnpi.local</span> / <span className="font-semibold">Admin@12345</span>
            </div>
          </div>
        </div>
      )}

      {resolveModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">الرد على التذكرة #{resolveModal.caseId}</div>
              <button onClick={closeResolveModal} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
            </div>
            <textarea
              value={resolveModal.answer}
              onChange={(event) => setResolveModal((prev) => ({ ...prev, answer: event.target.value }))}
              placeholder="اكتب رد الموظف هنا..."
              className="w-full min-h-[150px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeResolveModal} className="px-3 py-2 rounded-lg border text-sm">إلغاء</button>
              <button onClick={() => void submitResolve()} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">إرسال الرد وإغلاق التذكرة</button>
            </div>
          </div>
        </div>
      )}

      {ticketAnswerModal.open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">رد التذكرة #{ticketAnswerModal.caseId}</div>
              <button onClick={closeTicketAnswerModal} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">السؤال</div>
                <div className="whitespace-pre-wrap leading-7">{ticketAnswerModal.question}</div>
              </div>
              <div className="rounded-lg border border-emerald-300/40 dark:border-emerald-700/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-3">
                <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">الرد</div>
                <div className="whitespace-pre-wrap leading-7">{ticketAnswerModal.answer}</div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={closeTicketAnswerModal} className="px-3 py-2 rounded-lg border text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {!auth.isGuest && auth.role !== 'admin' && unreadClosed > 0 && (
        <div className="fixed bottom-4 left-4 text-xs bg-emerald-600 text-white rounded-lg px-3 py-2 flex items-center gap-1 shadow-lg">
          <CheckCircle2 size={12} /> لديك {unreadClosed} تذكرة تم الرد عليها
        </div>
      )}
    </div>
  );
}
