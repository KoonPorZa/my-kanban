import { it, vi, expect, describe, afterEach } from 'vitest';

import {
  importWorkspace,
  restoreArchivedIssue,
  getDeletionCandidates,
  previewWorkspaceImport,
  permanentlyDeleteIssue,
  downloadWorkspaceExport,
  permanentlyDeleteSprint,
  permanentlyDeleteProject,
} from './workspace-transfer';

const restoreIssueApi = vi.hoisted(() => vi.fn());

vi.mock('@my-kanban/api-client', () => ({ restoreIssue: restoreIssueApi }));

describe('workspace transfer actions', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('uploads the export and selected import mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ mode: 'merge', projectCount: 2 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['{}'], 'workspace.json', { type: 'application/json' });

    await expect(importWorkspace(file, 'merge')).resolves.toEqual({
      mode: 'merge',
      projectCount: 2,
    });
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/workspace-data/import');
    expect(request.method).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
    expect(request.body.get('mode')).toBe('merge');
    expect(request.body.get('file')).toBe(file);
  });

  it('surfaces the API domain error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid workspace export' } }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(importWorkspace(new File(['{}'], 'workspace.json'), 'replace')).rejects.toThrow(
      'Invalid workspace export'
    );
  });

  it('uploads to preview without calling the mutating import endpoint', async () => {
    const preview = {
      mode: 'replace',
      schemaVersion: 1,
      exportedAt: '2026-09-01T00:00:00.000Z',
      workspaceName: 'Personal',
      counts: { projects: 2, columns: 8, sprints: 1, issues: 12, checklistItems: 4 },
      impact: { newProjects: 1, matchingProjects: 1, projectsToArchive: 2 },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(preview), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['{}'], 'workspace.json', { type: 'application/json' });

    await expect(previewWorkspaceImport(file, 'replace')).resolves.toEqual(preview);

    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/workspace-data/import/preview');
    expect(request.method).toBe('POST');
    expect(request.body.get('mode')).toBe('replace');
    expect(request.body.get('file')).toBe(file);
  });

  it('sends the versioned permanent-delete request explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'sprint-id', deleted: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await permanentlyDeleteSprint('sprint-id', 4);

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/workspace-data/sprints/sprint-id', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 4 }),
    });
  });

  it('uses the resource-specific permanent-delete routes', async () => {
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(JSON.stringify({ id: 'deleted-id', deleted: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    await permanentlyDeleteProject('project-id', 2);
    await permanentlyDeleteIssue('issue-id', 3);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/workspace-data/projects/project-id',
      '/api/v1/workspace-data/issues/issue-id',
    ]);
  });

  it('loads deletion candidates with the browser session', async () => {
    const payload = { projects: [], sprints: [], issues: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDeletionCandidates()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/workspace-data/deletion-candidates', {
      credentials: 'include',
    });
  });

  it('delegates archived-task restore to the versioned generated client', async () => {
    restoreIssueApi.mockResolvedValue({ id: 'issue-id', version: 8 });

    await restoreArchivedIssue('issue-id', 7);

    expect(restoreIssueApi).toHaveBeenCalledWith('issue-id', { version: 7 });
  });

  it('downloads the server filename and revokes the object URL', async () => {
    const click = vi.fn();
    const anchor = { href: '', download: '', click };
    const createObjectURL = vi.fn(() => 'blob:workspace');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{}', {
          status: 200,
          headers: { 'content-disposition': 'attachment; filename="backup.json"' },
        })
      )
    );

    await downloadWorkspaceExport();

    expect(anchor).toMatchObject({ href: 'blob:workspace', download: 'backup.json' });
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:workspace');
  });

  it('falls back to the HTTP status when an error response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad gateway', { status: 502 })));

    await expect(getDeletionCandidates()).rejects.toThrow('Request failed (502)');
  });
});
