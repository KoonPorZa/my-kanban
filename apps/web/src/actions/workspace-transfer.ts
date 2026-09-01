'use client';

import { restoreIssue } from '@my-kanban/api-client';

import { redirectExpiredSession } from 'src/auth/utils/session-expiry';

export type WorkspaceImportMode = 'replace' | 'merge';

export type WorkspaceImportPreview = {
  mode: WorkspaceImportMode;
  schemaVersion: 1;
  exportedAt: string;
  workspaceName: string;
  counts: {
    projects: number;
    columns: number;
    sprints: number;
    issues: number;
    checklistItems: number;
  };
  impact: {
    newProjects: number;
    matchingProjects: number;
    projectsToArchive: number;
  };
};

export type DeletionCandidate = {
  id: string;
  version: number;
};

export type DeletionCandidates = {
  projects: Array<
    DeletionCandidate & {
      name: string;
      archivedAt: string;
      columnCount: number;
      issueCount: number;
      sprintCount: number;
      mcpTokenCount: number;
      mcpAuditEventCount: number;
    }
  >;
  sprints: Array<
    DeletionCandidate & {
      name: string;
      status: 'planned' | 'completed';
      projectName: string;
      issueCount: number;
    }
  >;
  issues: Array<
    DeletionCandidate & {
      title: string;
      archivedAt: string;
      projectName: string;
      checklistCount: number;
    }
  >;
};

export async function downloadWorkspaceExport() {
  const response = await fetch('/api/v1/workspace-data/export', { credentials: 'include' });
  if (!response.ok) throw await responseError(response);

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? 'my-kanban-workspace-v1.json';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importWorkspace(file: File, mode: WorkspaceImportMode) {
  return uploadWorkspaceImport<{ mode: WorkspaceImportMode; projectCount: number }>(
    '/api/v1/workspace-data/import',
    file,
    mode
  );
}

export async function previewWorkspaceImport(file: File, mode: WorkspaceImportMode) {
  return uploadWorkspaceImport<WorkspaceImportPreview>(
    '/api/v1/workspace-data/import/preview',
    file,
    mode
  );
}

async function uploadWorkspaceImport<Result>(
  endpoint: string,
  file: File,
  mode: WorkspaceImportMode
) {
  const body = new FormData();
  body.set('mode', mode);
  body.set('file', file);
  const response = await fetch(endpoint, {
    method: 'POST',
    body,
    credentials: 'include',
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<Result>;
}

export async function restoreArchivedIssue(issueId: string, version: number) {
  return restoreIssue(issueId, { version });
}

export async function getDeletionCandidates() {
  const response = await fetch('/api/v1/workspace-data/deletion-candidates', {
    credentials: 'include',
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<DeletionCandidates>;
}

export function permanentlyDeleteProject(projectId: string, version: number) {
  return permanentDelete('projects', projectId, version);
}

export function permanentlyDeleteSprint(sprintId: string, version: number) {
  return permanentDelete('sprints', sprintId, version);
}

export function permanentlyDeleteIssue(issueId: string, version: number) {
  return permanentDelete('issues', issueId, version);
}

async function permanentDelete(
  resource: 'projects' | 'sprints' | 'issues',
  id: string,
  version: number
) {
  const response = await fetch(`/api/v1/workspace-data/${resource}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version }),
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<{ id: string; deleted: true }>;
}

async function responseError(response: Response) {
  redirectExpiredSession(response.status, response.url);
  const fallback = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { error?: { message?: string }; message?: string };
    return new Error(body.error?.message ?? body.message ?? fallback);
  } catch {
    return new Error(fallback);
  }
}
