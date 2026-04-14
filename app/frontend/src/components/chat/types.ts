import type { ReactNode } from "react";

export type Citation = {
  source_id: string;
  page: number;
  source_name: string;
};

export type MessageMeta = {
  response_id?: string;
  confidence?: number;
  citations?: Citation[];
  escalated?: boolean;
  escalation_reason?: string | null;
  escalation_confirmation_required?: boolean;
  clarification_requested?: boolean;
  suggestions?: string[];
  totalClientMs?: number;
  firstTokenMs?: number;
  streamChunkEvents?: number;
  chunks_used?: number;
  timings?: Record<string, number>;
  review_status?: string;
  review_issues?: string[];
  review_warning?: string | null;
  correction?: { text: string; label?: string } | null;
  path?: string;
  final_confidence?: number;
  transfer?: { occurred: boolean; from_agent: string; to_agent: string; reason: string } | null;
  caseId?: string;
  caseCreated?: boolean;
  caseCreating?: boolean;
  thinkingContent?: string;
};

export type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceRef[];
  confidence?: number;
  mode?: string;
  timestamp: string;
  escalated?: boolean;
  metadata?: MessageMeta;
};

export type SourceRef = {
  id: string;
  sourceId: string;
  title: string;
  ministry: string;
  page: number;
  relevance: number;
};

export type SelectedSource = {
  sourceId: string;
  sourceName: string;
  page: number;
};

export type PipelineStep =
  | "input_guardrail"
  | "intent_clarity"
  | "transfer_check"
  | "embed_and_rewrite"
  | "workflow_match"
  | "retrieve"
  | "generate"
  | "output_guardrail"
  | "post_generation"
  | "escalation_check"
  | "suggestions";

export const PIPELINE_STEPS: PipelineStep[] = [
  "input_guardrail", "intent_clarity", "transfer_check",
  "embed_and_rewrite", "workflow_match", "retrieve",
  "generate", "output_guardrail", "post_generation",
  "escalation_check", "suggestions",
];

export type LoadingProgress = {
  currentStep: PipelineStep | null;
  completedSteps: PipelineStep[];
  chunkCount: number;
  citationCount: number;
  reviewWarningSeen: boolean;
  correctionSeen: boolean;
  startedAt: number | null;
  currentLabel: string;
};

export const AGENT_LABELS_EN: Record<string, string> = {
  CIVIL_SERVICE_AGENT: "Civil Service Bureau",
  LABOR_AGENT: "Ministry of Labor",
  JUSTICE_AGENT: "Ministry of Justice",
  CIVIL_STATUS_AGENT: "Civil Status Dept.",
  DIGITAL_ECONOMY_AGENT: "Digital Economy & Entrepreneurship",
};

export const AGENT_LABELS_AR: Record<string, string> = {
  CIVIL_SERVICE_AGENT: "ديوان الخدمة المدنية",
  LABOR_AGENT: "وزارة العمل",
  JUSTICE_AGENT: "وزارة العدل",
  CIVIL_STATUS_AGENT: "الأحوال المدنية",
  DIGITAL_ECONOMY_AGENT: "الاقتصاد الرقمي والريادة",
};

export interface ChatContextType {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  mode: "fast" | "thinking";
  setMode: (m: "fast" | "thinking") => void;
  agentId: string | null;
  setAgentId: (id: string | null) => void;
  loading: boolean;
  loadingProgress: LoadingProgress;
  loadingElapsedMs: number;
  thinkingContent: string;
  selectedSource: SelectedSource | null;
  setSelectedSource: (s: SelectedSource | null) => void;
  detailsPanelOpen: boolean;
  selectedMessageForDetails: string | null;
  savedMessageIds: Set<string>;
  expandedCitations: Set<string>;
  setExpandedCitations: React.Dispatch<React.SetStateAction<Set<string>>>;
  isEmptyState: boolean;
  sendMessage: (text?: string) => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleNewChat: () => void;
  onToggleSave: (msg: Msg, index: number) => void;
  openSourceViewer: (source?: SourceRef) => void;
  openCitationViewer: (citation: Citation) => void;
  openDetailsPanel: (messageId: string) => void;
  closeDetailsPanel: () => void;
  formatContent: (content: string, sources?: SourceRef[]) => ReactNode;
  confidenceLabel: (value: number) => string | undefined;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
