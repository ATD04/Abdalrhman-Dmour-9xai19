/**
 * JNPI Agent Service API Client
 * ================================
 * Typed async functions for the four new agent-service endpoints.
 * Derived from agent-service/models/schemas.py Pydantic models.
 *
 * FIX 4 — JNPI-AGENT-004: wires previously unreachable endpoints into typed,
 * callable functions so the UI can consume them.
 */

const AGENT_BASE_URL = 'http://localhost:9200';

// ─── Shared error shape ────────────────────────────────────────────────────

export type ApiError = {
  error: true;
  message: string;
  status: number;
};

// ─── Input / Output types (derived from agent-service Pydantic schemas) ───

/** Matches agent-service Citation Pydantic model */
export type CitationDetail = {
  source_name: string;
  source_id: string;
  page: number;
  document_year?: string | null;
  is_amendment: boolean;
  relevance_score: number;
};

/** Matches agent-service QueryResponse Pydantic model */
export type QueryResponse = {
  answer: string;
  confidence: number;
  citations: CitationDetail[];
  agent_used: string;
  sector: string;
  has_amendments: boolean;
  amendment_note?: string | null;
  escalated: boolean;
  escalation_reason?: string | null;
  escalation_confirmation_required: boolean;
  session_id?: string | null;
  response_id?: string | null;
  path?: string | null;
  timings: Record<string, number>;
  chunks_used: number;
};

/** Matches agent-service RoutingDecision Pydantic model */
export type RoutingDecision = {
  intent: string;
  sector: string;
  agent: string;
  requires_delegation: boolean;
  sub_questions: { question: string; agent: string; sector?: string | null }[];
  wants_human_handoff: boolean;
  path: "single_agent_fast" | "multi_agent_orchestrated";
  confidence_hint: number;
};

/** Matches agent-service ExplainResponse Pydantic model */
export type ExplanationResult = {
  response_id: string;
  routing_decision: RoutingDecision;
  confidence_breakdown: Record<string, unknown>;
};

/** Confidence breakdown result (from /confidence/{id}) */
export type ConfidenceResult = {
  response_id: string;
  confidence: number;
  breakdown: Record<string, number | string>;
};

/** Matches agent-service ValidateRequest Pydantic model */
export type ValidatePayload = {
  answer: string;
  source_ids: string[];
  query?: string;
};

/** Matches agent-service ValidateResponse Pydantic model */
export type ValidationResult = {
  valid: boolean;
  issues: string[];
  corrected_answer?: string | null;
};

/** Matches agent-service DelegateRequest Pydantic model */
export type DelegatePayload = {
  query: string;
  agent: string;
  sector?: string;
  user_type?: string;
  language?: string;
};

// ─── Shared fetch helper ───────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T | ApiError> {
  try {
    const response = await fetch(`${AGENT_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!response.ok) {
      return {
        error: true,
        message: `Request failed: ${response.statusText}`,
        status: response.status,
      };
    }
    return (await response.json()) as T;
  } catch (err) {
    return {
      error: true,
      message: err instanceof Error ? err.message : 'Network error',
      status: 0,
    };
  }
}

// ─── Exported API functions ────────────────────────────────────────────────

/**
 * Fetch confidence breakdown for a completed response.
 * Endpoint: GET /confidence/{id}
 * UI Context: Renders when the user clicks the confidence score badge on a
 *             response card — shows a detailed modal/drawer with per-factor scores.
 */
export async function fetchConfidence(
  responseId: string,
): Promise<ConfidenceResult | ApiError> {
  return apiFetch<ConfidenceResult>(`/confidence/${encodeURIComponent(responseId)}`);
}

/**
 * TODO (Sprint N+1): Wire to Policy Validation Panel.
 * Endpoint: POST /validate
 * UI Context: Governance dashboard — allows analysts to validate a policy
 *             reference before submitting for HITL review.
 */
export async function validateQuery(
  payload: ValidatePayload,
): Promise<ValidationResult | ApiError> {
  return apiFetch<ValidationResult>('/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch the routing/reasoning explanation for a completed response.
 * Endpoint: GET /explain_decision/{id}
 * UI Context: "Why this answer?" expandable panel beneath each assistant
 *             message card — shows intent classification, agent selected, etc.
 */
export async function fetchExplanation(
  responseId: string,
): Promise<ExplanationResult | ApiError> {
  return apiFetch<ExplanationResult>(
    `/explain_decision/${encodeURIComponent(responseId)}`,
  );
}

/**
 * TODO (Sprint N+1): Wire to Agent-Picker interface.
 * Endpoint: POST /delegate
 * UI Context: Advanced query panel — allows power users to explicitly route
 *             a query to a named specialist agent (legal, economic, etc.).
 */
export async function delegateQuery(
  payload: DelegatePayload,
): Promise<QueryResponse | ApiError> {
  return apiFetch<QueryResponse>('/delegate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
