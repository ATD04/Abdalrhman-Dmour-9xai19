import { COMPANY_ID } from './config';
import type { Issue, Agent, Project, Comment, Activity } from './types';

const BASE = '/api';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// Issues
export function fetchIssues(params?: {
  projectId?: string;
  status?: string;
  limit?: number;
}): Promise<Issue[]> {
  const q = new URLSearchParams();
  q.set('companyId', COMPANY_ID);
  if (params?.projectId) q.set('projectId', params.projectId);
  if (params?.status)    q.set('status', params.status);
  if (params?.limit)     q.set('limit', String(params.limit));
  return api<Issue[]>(`/companies/${COMPANY_ID}/issues?${q}`);
}

export function fetchIssue(id: string): Promise<Issue> {
  return api<Issue>(`/issues/${id}`);
}

// Comments — correct path: /api/issues/:id/comments
export function fetchComments(issueId: string): Promise<Comment[]> {
  return api<Comment[]>(`/issues/${issueId}/comments`);
}

export function postComment(issueId: string, body: string): Promise<Comment> {
  return api<Comment>(`/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

// Agents
export function fetchAgents(): Promise<Agent[]> {
  return api<Agent[]>(`/companies/${COMPANY_ID}/agents`);
}

// Projects
export function fetchProjects(): Promise<Project[]> {
  return api<Project[]>(`/companies/${COMPANY_ID}/projects`);
}

// Runs — use correct endpoints
export interface LiveRun {
  id: string;
  status: 'running' | 'queued';
  agentId: string;
  agentName?: string;
  issueId?: string;
  issueTitle?: string;
  startedAt?: string;
}

export interface HeartbeatRun {
  id: string;
  status: 'done' | 'error' | 'cancelled';
  agentId: string;
  agentName?: string;
  issueId?: string;
  issueTitle?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export function fetchLiveRuns(): Promise<LiveRun[]> {
  return api<LiveRun[]>(`/companies/${COMPANY_ID}/live-runs`);
}

export function fetchRecentRuns(params?: { agentId?: string; limit?: number }): Promise<HeartbeatRun[]> {
  const q = new URLSearchParams();
  if (params?.agentId) q.set('agentId', params.agentId);
  if (params?.limit)   q.set('limit', String(params.limit));
  return api<HeartbeatRun[]>(`/companies/${COMPANY_ID}/heartbeat-runs?${q}`);
}

// Activity
export function fetchActivity(limit = 20): Promise<Activity[]> {
  return api<Activity[]>(`/companies/${COMPANY_ID}/activity?limit=${limit}`);
}

// Dashboard summary
export function fetchDashboard(): Promise<Record<string, unknown>> {
  return api<Record<string, unknown>>(`/companies/${COMPANY_ID}/dashboard`);
}
