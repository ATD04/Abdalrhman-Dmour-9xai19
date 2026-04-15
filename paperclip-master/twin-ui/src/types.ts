export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface Issue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assigneeAgentId?: string | null;
  projectId?: string | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string | null;
  dueDate?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  model?: string;
  lastActiveAt?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  companyId: string;
}

export interface Run {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  agentId: string;
  agentName?: string;
  issueId?: string | null;
  issueTitle?: string | null;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface Comment {
  id: string;
  body: string;
  authorType: 'agent' | 'user';
  authorId: string;
  issueId: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}
