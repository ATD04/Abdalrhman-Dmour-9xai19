/**
 * Centralized API Service Layer
 * Provides typed interfaces for all backend microservices
 */

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const SERVICES = {
  agent: process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:9200',
  knowledge: process.env.NEXT_PUBLIC_KNOWLEDGE_URL || 'http://localhost:9100',
  governance: process.env.NEXT_PUBLIC_GOVERNANCE_URL || 'http://localhost:9300',
  workflow: process.env.NEXT_PUBLIC_WORKFLOW_URL || 'http://localhost:9400',
} as const;

export type ServiceName = keyof typeof SERVICES;

export function getServiceBaseUrl(service: ServiceName): string {
  return SERVICES[service];
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared Types
// ═══════════════════════════════════════════════════════════════════════════

export type UserType = 'citizen' | 'operator' | 'admin';
export type Language = 'ar' | 'en';
export type Visibility = 'public' | 'internal' | 'confidential';
export type CaseStatus = 'open' | 'pending' | 'closed';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

export class ApiException extends Error {
  constructor(public error: ApiError) {
    super(error.message);
    this.name = 'ApiException';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Utilities
// ═══════════════════════════════════════════════════════════════════════════

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiException({
      message: `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
      detail,
    });
  }

  if (response.status === 204) {
    return null as T;
  }

  const textBody = await response.text();
  if (!textBody) {
    return null as T;
  }

  return JSON.parse(textBody) as T;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENT SERVICE (Port 9200)
// ═══════════════════════════════════════════════════════════════════════════

export interface Citation {
  source_id: string;
  source_name: string;
  page: number;
  document_year?: string;
  is_amendment?: boolean;
  relevance_score?: number;
}

export interface QueryRequest {
  query: string;
  user_type?: UserType;
  session_id?: string;
  user_id?: string;
  sector_hint?: string;
  language?: Language;
  mode?: 'concise' | 'detailed';
  agent_id?: string;
}

export interface QueryResponse {
  answer: string;
  confidence: number;
  citations: Citation[];
  agent_used: string;
  sector: string;
  has_amendments: boolean;
  amendment_note?: string;
  escalated: boolean;
  escalation_reason?: string;
  escalation_confirmation_required: boolean;
  session_id?: string;
  response_id?: string;
  path?: 'single_agent_fast' | 'multi_agent_orchestrated';
  review_status?: string;
  review_issues?: string[];
  timings?: Record<string, number>;
  chunks_used: number;
}

export const agentService = {
  baseUrl: SERVICES.agent,

  async query(): Promise<QueryResponse> {
    throw new ApiException({
      message: 'Non-stream query mode is disabled. Use queryStream() with SSE.',
      status: 410,
      detail: '/query is disabled on agent-service; use /query/stream.',
    });
  },

  queryStream(): string {
    // Returns the URL for SSE streaming
    return `${this.baseUrl}/query/stream`;
  },

  async getConfidence(responseId: string) {
    return request<{ breakdown: Record<string, number> }>(
      `${this.baseUrl}/confidence/${responseId}`
    );
  },

  async health() {
    return request<{ status: string }>(`${this.baseUrl}/health`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE SERVICE (Port 9100)
// ═══════════════════════════════════════════════════════════════════════════

export interface SourceInfo {
  source_id: string;
  source_name: string;
  filename: string;
  file_type: string;
  doc_type: string;
  total_chunks: number;
  current_version: number;
  tags: string[];
  language: string;
  visibility: Visibility;
  approval_status?: string;
  date_of_the_constitution?: string | null;
  ministry_name?: string | null;
  ministry_type?: string;
  source_group_id?: string | null;
  source_group_name?: string | null;
  group_role?: string;
  created_at: string;
  updated_at: string;
  sector?: string;
  classification?: {
    sector: string;
    doc_type: string;
    confidence: number;
  };
}

export interface ChunkResult {
  chunk_id: string;
  source_id: string;
  source_name: string;
  filename: string;
  page: number;
  text: string;
  score: number;
  version: number;
  chunk_type: string;
  metadata: Record<string, unknown>;
}

type KnowledgeRetrieveRaw = {
  chunks?: ChunkResult[];
  results?: ChunkResult[];
};

export interface RetrieveRequest {
  query: string;
  top_k?: number;
  source_ids?: string[];
  tags?: string[];
  doc_type?: string;
  sector?: string;
  visibility?: Visibility;
  min_score?: number;
}

export interface IngestResponse {
  source_id: string;
  filename: string;
  source_name: string;
  chunks_created: number;
  version: number;
  status: string;
  doc_type: string;
  source_group_id?: string | null;
  source_group_name?: string | null;
  group_role?: string;
  ministry_name?: string | null;
  date_of_the_constitution?: string | null;
}

export const knowledgeService = {
  baseUrl: SERVICES.knowledge,

  async listSources(): Promise<{ sources: SourceInfo[] }> {
    const data = await request<{ sources?: SourceInfo[] } | SourceInfo[]>(`${this.baseUrl}/sources`);
    if (Array.isArray(data)) {
      return { sources: data };
    }

    return { sources: data.sources || [] };
  },

  async getSource(sourceId: string): Promise<SourceInfo> {
    return request<SourceInfo>(`${this.baseUrl}/sources/${sourceId}`);
  },

  async deleteSource(sourceId: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`${this.baseUrl}/sources/${sourceId}`, {
      method: 'DELETE',
    });
  },

  async retrieve(req: RetrieveRequest): Promise<{ chunks: ChunkResult[]; results: ChunkResult[] }> {
    const data = await request<KnowledgeRetrieveRaw>(`${this.baseUrl}/retrieve`, {
      method: 'POST',
      body: JSON.stringify(req),
    });

    const normalized = data.results || data.chunks || [];
    return { chunks: normalized, results: normalized };
  },

  async ingest(file: File, metadata?: Record<string, string>): Promise<IngestResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }

    const response = await fetch(`${this.baseUrl}/ingest`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ApiException({
        message: `Upload failed: ${response.statusText}`,
        status: response.status,
        detail,
      });
    }

    return response.json();
  },

  getFileUrl(sourceId: string): string {
    return `${this.baseUrl}/sources/${sourceId}/file`;
  },

  getPageImageUrl(sourceId: string, page: number): string {
    return `${this.baseUrl}/sources/${sourceId}/page/${page}`;
  },

  async health() {
    return request<{ status: string }>(`${this.baseUrl}/health`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GOVERNANCE SERVICE (Port 9300)
// ═══════════════════════════════════════════════════════════════════════════

export interface MetricsResult {
  period: string;
  total_queries: number;
  avg_latency_ms: number;
  p95_latency_ms?: number;
  avg_confidence: number;
  escalation_rate: number;
  guardrail_rejection_rate: number;
  sector_distribution: Record<string, number>;
  agent_distribution?: Record<string, number>;
}

export interface TopicTrendPoint {
  date: string;
  count: number;
}

export interface TopicTrendSeries {
  topic_key: string;
  label_en: string;
  label_ar: string;
  total: number;
  points: TopicTrendPoint[];
}

export interface TopicStat {
  topic_key: string;
  label_en: string;
  label_ar: string;
  count: number;
  share: number;
  avg_confidence?: number | null;
  escalation_rate: number;
  guardrail_rejection_rate: number;
  avg_latency_ms?: number | null;
  sample_queries: string[];
}

export interface RisingTopic {
  topic_key: string;
  label_en: string;
  label_ar: string;
  current_count: number;
  previous_count: number;
  delta: number;
  growth_rate?: number | null;
  breakout: boolean;
}

export interface TopicRecommendation {
  target: 'admin' | 'operator';
  topic_key: string;
  topic_label_en: string;
  topic_label_ar: string;
  priority: 'high' | 'medium' | 'low' | string;
  title_en: string;
  title_ar: string;
  rationale_en: string;
  rationale_ar: string;
  suggested_rule?: string;
  suggested_rule_ar?: string;
  suggested_solution?: string;
  suggested_solution_ar?: string;
}

export interface TopicInsightsResult {
  period: string;
  window_start: string;
  window_end: string;
  total_queries: number;
  analyzed_queries: number;
  top_topics: TopicStat[];
  rising_topics: RisingTopic[];
  trend_series: TopicTrendSeries[];
  recommendations_admin: TopicRecommendation[];
  recommendations_executive: TopicRecommendation[];
}

export interface AuditEntry {
  id: number;
  request_id: string;
  session_id?: string;
  query: string;
  user_type: string;
  intent?: string;
  sector?: string;
  agent_used?: string;
  answer?: string;
  confidence?: number;
  has_amendments?: boolean;
  escalated?: boolean;
  input_passed: boolean;
  output_passed: boolean;
  latencies?: number;
  citations_count?: number;
  chunks_used?: number;
  created_at: string;
}

export interface AuditListResponse {
  records: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
}

export interface ReleaseStatus {
  services: ServiceHealth[];
  overall: 'healthy' | 'degraded' | 'unhealthy';
}

export const governanceService = {
  baseUrl: SERVICES.governance,

  async getMetrics(period: string = '24h'): Promise<MetricsResult> {
    return request<MetricsResult>(`${this.baseUrl}/metrics?period=${period}`);
  },

  async getTopicInsights(period: '7d' | '30d' | '90d' = '30d', topK: number = 8): Promise<TopicInsightsResult> {
    const params = new URLSearchParams();
    params.set('period', period);
    params.set('top_k', String(topK));
    return request<TopicInsightsResult>(`${this.baseUrl}/topic-insights?${params.toString()}`);
  },

  async listAuditLogs(params: {
    page?: number;
    page_size?: number;
    user_type?: string;
    sector?: string;
    escalated?: boolean;
  } = {}): Promise<AuditListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.page_size) searchParams.set('page_size', String(params.page_size));
    if (params.user_type) searchParams.set('user_type', params.user_type);
    if (params.sector) searchParams.set('sector', params.sector);
    if (params.escalated !== undefined) searchParams.set('escalated', String(params.escalated));

    return request<AuditListResponse>(
      `${this.baseUrl}/audit?${searchParams.toString()}`
    );
  },

  async getAuditEntry(requestId: string): Promise<AuditEntry> {
    return request<AuditEntry>(`${this.baseUrl}/audit/${requestId}`);
  },

  async getReleaseStatus(): Promise<ReleaseStatus> {
    return request<ReleaseStatus>(`${this.baseUrl}/release_status`);
  },

  async getRecentLogs(limit: number = 20): Promise<AuditEntry[]> {
    return request<AuditEntry[]>(`${this.baseUrl}/logs?limit=${limit}`);
  },

  async health() {
    return request<{ status: string }>(`${this.baseUrl}/health`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW SERVICE (Port 9400)
// ═══════════════════════════════════════════════════════════════════════════

export interface TimelineEvent {
  timestamp: string;
  event_type: string;
  actor?: string;
  details?: string;
}

export interface CaseRecord {
  case_id: string;
  request_id: string;
  session_id?: string;
  user_id?: string;
  query: string;
  query_hash: string;
  status: CaseStatus;
  priority: CasePriority;
  sector_primary: string;
  sector_labels: string[];
  escalation_reason: string;
  confidence?: number;
  assigned_to?: string;
  resolution_answer?: string;
  resolution_note?: string;
  is_faq_candidate: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  timeline: TimelineEvent[];
}

export interface CaseCreateRequest {
  request_id: string;
  session_id?: string;
  user_id?: string;
  query: string;
  user_type: string;
  sector_primary: string;
  sector_labels: string[];
  priority: CasePriority;
  escalation_reason: string;
  confidence?: number;
  source_response_id?: string;
}

export interface CaseUpdateRequest {
  status?: CaseStatus;
  priority?: CasePriority;
  assigned_to?: string;
}

export interface CaseResolveRequest {
  resolution_answer: string;
  resolution_note?: string;
  actor: string;
}

export interface CaseListResponse {
  cases: CaseRecord[];
  total: number;
  page: number;
  page_size: number;
}

export const workflowService = {
  baseUrl: SERVICES.workflow,

  async createCase(req: CaseCreateRequest): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases`, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async listCases(params: {
    status?: CaseStatus;
    priority?: CasePriority;
    assignee?: string;
    page?: number;
    page_size?: number;
  } = {}): Promise<CaseListResponse> {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.priority) searchParams.set('priority', params.priority);
    if (params.assignee) searchParams.set('assignee', params.assignee);
    if (params.page) searchParams.set('page', String(params.page));
    if (params.page_size) searchParams.set('page_size', String(params.page_size));

    return request<CaseListResponse>(
      `${this.baseUrl}/cases?${searchParams.toString()}`
    );
  },

  async getCase(caseId: string): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases/${caseId}`);
  },

  async updateCase(caseId: string, updates: CaseUpdateRequest): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases/${caseId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async addNote(caseId: string, note: string, actor: string): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases/${caseId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note, actor }),
    });
  },

  async resolveCase(caseId: string, resolution: CaseResolveRequest): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases/${caseId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    });
  },

  async deleteCase(caseId: string): Promise<{ deleted: boolean; case_id: string }> {
    return request<{ deleted: boolean; case_id: string }>(`${this.baseUrl}/cases/${caseId}`, {
      method: 'DELETE',
    });
  },

  async getUserCases(userId: string, pageSize: number = 50): Promise<CaseListResponse> {
    return request<CaseListResponse>(
      `${this.baseUrl}/users/${encodeURIComponent(userId)}/cases?page_size=${pageSize}`
    );
  },

  async markFaqCandidate(caseId: string, isFaq: boolean): Promise<CaseRecord> {
    return request<CaseRecord>(`${this.baseUrl}/cases/${caseId}/faq_candidate`, {
      method: 'POST',
      body: JSON.stringify({ is_faq_candidate: isFaq }),
    });
  },

  async findMatchingAnswer(params: {
    query: string;
    userId?: string;
    sessionId?: string;
  }): Promise<{ found: boolean; case_id?: string; resolution_answer?: string; resolved_at?: string; query?: string }> {
    const searchParams = new URLSearchParams();
    searchParams.set('query', params.query);
    if (params.userId) searchParams.set('user_id', params.userId);
    if (params.sessionId) searchParams.set('session_id', params.sessionId);

    return request<{ found: boolean; case_id?: string; resolution_answer?: string; resolved_at?: string; query?: string }>(
      `${this.baseUrl}/cases/answered/match?${searchParams.toString()}`
    );
  },

  async health() {
    return request<{ status: string }>(`${this.baseUrl}/health`);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Health Check Utilities
// ═══════════════════════════════════════════════════════════════════════════

export async function checkAllServices(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  const checks = [
    { name: 'agent', fn: () => agentService.health() },
    { name: 'knowledge', fn: () => knowledgeService.health() },
    { name: 'governance', fn: () => governanceService.health() },
    { name: 'workflow', fn: () => workflowService.health() },
  ];

  await Promise.all(
    checks.map(async ({ name, fn }) => {
      try {
        await fn();
        results[name] = true;
      } catch {
        results[name] = false;
      }
    })
  );

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// Escalation & Case Management Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a case from an escalated query
 * Called when AI response confidence is low and needs expert review
 */
export async function createCaseFromEscalation(params: {
  requestId: string;
  query: string;
  userId?: string;
  sessionId?: string;
  userType?: string;
  sector: string;
  confidence?: number;
  escalationReason: string;
}): Promise<CaseRecord | null> {
  try {
    return await workflowService.createCase({
      request_id: params.requestId,
      query: params.query,
      user_id: params.userId,
      session_id: params.sessionId,
      user_type: params.userType || 'citizen',
      sector_primary: params.sector || 'general',
      sector_labels: [params.sector || 'general'],
      priority: 'high',
      escalation_reason: params.escalationReason,
      confidence: params.confidence,
    });
  } catch (error) {
    console.error('Failed to create case from escalation:', error);
    return null;
  }
}

/**
 * Gets a case by request ID (for linking escalated queries to cases)
 */
export async function getCaseByRequestId(requestId: string): Promise<CaseRecord | null> {
  try {
    return await workflowService.getCase(requestId);
  } catch {
    return null;
  }
}
