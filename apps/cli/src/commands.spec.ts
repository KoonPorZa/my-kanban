import { describe, expect, it, vi } from 'vitest';

import { runCli } from './commands.js';
import type { CliDependencies, ProjectAlias } from './types.js';

function dependencies() {
  const projects: ProjectAlias[] = [];
  const deps: CliDependencies = {
    keychain: { save: vi.fn(), get: vi.fn().mockResolvedValue('secret-token'), remove: vi.fn() },
    store: {
      list: vi.fn(async () => projects),
      get: vi.fn(async (alias) => projects.find((project) => project.alias === alias) ?? null),
      upsert: vi.fn(async (project) => {
        const index = projects.findIndex((item) => item.alias === project.alias);
        if (index >= 0) projects[index] = project;
        else projects.push(project);
      }),
      remove: vi.fn(async (alias) => {
        const index = projects.findIndex((project) => project.alias === alias);
        if (index >= 0) projects.splice(index, 1);
      }),
    },
    inspect: vi.fn().mockResolvedValue({
      projectId: 'project-id',
      projectName: 'My Project',
      expiresAt: '2026-11-29T00:00:00.000Z',
      lastUsedAt: null,
    }),
    readSecret: vi.fn().mockResolvedValue('secret-token'),
    checkClient: vi.fn().mockResolvedValue(true),
    launch: vi.fn().mockResolvedValue(0),
    stdout: vi.fn(),
    stderr: vi.fn(),
  };
  return { deps, projects };
}

describe('kanban helper commands', () => {
  it('validates a token before storing it and never writes it to metadata', async () => {
    const { deps, projects } = dependencies();

    await expect(
      runCli(['project', 'add', 'work', '--url', 'http://localhost:8083/mcp'], deps)
    ).resolves.toBe(0);

    expect(deps.inspect).toHaveBeenCalledWith('http://localhost:8083/mcp', 'secret-token');
    expect(deps.keychain.save).toHaveBeenCalledWith('work', 'secret-token');
    expect(JSON.stringify(projects)).not.toContain('secret-token');
  });

  it('launches a client with only the selected alias token', async () => {
    const { deps, projects } = dependencies();
    projects.push({
      alias: 'work',
      url: 'http://localhost:8083/mcp',
      projectId: 'project-id',
      projectName: 'My Project',
      expiresAt: '2026-11-29T00:00:00.000Z',
      lastUsedAt: null,
    });

    await expect(runCli(['codex', 'work', '--', '--full-auto'], deps)).resolves.toBe(0);

    expect(deps.launch).toHaveBeenCalledWith('codex', ['--full-auto'], 'secret-token');
  });

  it('removes only the local Keychain credential and alias metadata', async () => {
    const { deps } = dependencies();

    await expect(runCli(['project', 'remove', 'work'], deps)).resolves.toBe(0);

    expect(deps.keychain.remove).toHaveBeenCalledWith('work');
    expect(deps.store.remove).toHaveBeenCalledWith('work');
  });
});
