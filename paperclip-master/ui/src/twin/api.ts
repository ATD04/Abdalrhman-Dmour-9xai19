// Minister Digital Twin — API integration layer
// Wraps existing Paperclip API with twin-specific query helpers

import { api } from "../api/client";
import type { Issue, Agent, Project, RoutineListItem } from "@paperclipai/shared";
import type { LiveRunForIssue } from "../api/heartbeats";
import { TWIN_COMPANY_ID } from "./config";

export interface IssueComment {
  id: string;
  body: string;
  createdAt: string;
  authorName?: string;
}

// Issues
export const twinApi = {
  getIssues: (projectId: string, status?: string) => {
    const qs = new URLSearchParams();
    qs.set("projectId", projectId);
    if (status) qs.set("status", status);
    return api.get<Issue[]>(`/companies/${TWIN_COMPANY_ID}/issues?${qs}`);
  },

  getAllIssues: () =>
    api.get<Issue[]>(`/companies/${TWIN_COMPANY_ID}/issues`),

  createIssue: (data: {
    title: string;
    description?: string;
    priority?: string;
    projectId: string;
    assigneeAgentId?: string;
    goalId?: string;
  }) => api.post<Issue>(`/companies/${TWIN_COMPANY_ID}/issues`, data),

  getIssueComments: (issueId: string) =>
    api.get<IssueComment[]>(`/issues/${issueId}/comments`),

  // Agents
  getAgents: () =>
    api.get<Agent[]>(`/companies/${TWIN_COMPANY_ID}/agents`),

  wakeAgent: (agentId: string, payload: { issueId?: string } = {}) =>
    api.post<{ runId: string }>(`/agents/${agentId}/wakeup`, {
      source: "on_demand",
      triggerDetail: "manual",
      payload,
    }),

  // Projects
  getProjects: () =>
    api.get<Project[]>(`/companies/${TWIN_COMPANY_ID}/projects`),

  // Routines
  getRoutines: () =>
    api.get<RoutineListItem[]>(`/companies/${TWIN_COMPANY_ID}/routines`),

  runRoutine: (routineId: string) =>
    api.post<{ runId: string }>(`/routines/${routineId}/run`, {}),

  // Live runs
  getLiveRuns: () =>
    api.get<LiveRunForIssue[]>(`/companies/${TWIN_COMPANY_ID}/live-runs`),

  getIssueCommentsFull: (issueId: string) =>
    api.get<IssueComment[]>(`/issues/${issueId}/comments`),
};
