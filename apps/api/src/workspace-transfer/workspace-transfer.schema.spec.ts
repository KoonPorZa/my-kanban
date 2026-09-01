import { describe, expect, it } from 'vitest';

import { workspaceExportSchema } from './workspace-transfer.schema';

const projectId = '11111111-1111-4111-8111-111111111111';
const columnId = '22222222-2222-4222-8222-222222222222';
const doneColumnId = '55555555-5555-4555-8555-555555555555';
const issueId = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-09-01T09:00:00.000Z';

function validExport() {
  return {
    schemaVersion: 1,
    exportedAt: timestamp,
    workspace: {
      name: 'Personal',
      activeProjectId: projectId,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    projects: [
      {
        id: projectId,
        name: 'Kanban',
        color: 'primary',
        mode: 'kanban',
        doneRetentionDays: 30,
        version: 1,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        columns: [
          {
            id: columnId,
            name: 'Backlog',
            category: 'todo',
            rank: '1024',
            wipLimit: null,
            version: 1,
            archivedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          {
            id: doneColumnId,
            name: 'Done',
            category: 'done',
            rank: '2048',
            wipLimit: null,
            version: 1,
            archivedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        sprints: [],
        issues: [
          {
            id: issueId,
            sprintId: null,
            columnId,
            title: 'Recover me',
            description: '',
            type: 'task',
            priority: 'medium',
            labels: [],
            storyPoints: null,
            rank: '1024',
            version: 1,
            dueDate: null,
            isBlocked: false,
            blockedReason: null,
            archivedAt: null,
            completedAt: null,
            checklist: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      },
    ],
  };
}

describe('workspaceExportSchema', () => {
  it('accepts schema v1 with string ranks and ISO dates', () => {
    expect(workspaceExportSchema.safeParse(validExport()).success).toBe(true);
  });

  it('rejects unknown fields so secret entities cannot be smuggled in', () => {
    const input = { ...validExport(), authIdentities: [] };
    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects references outside their project', () => {
    const input = validExport();
    input.projects[0].issues[0].columnId = '44444444-4444-4444-8444-444444444444';
    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects numeric ranks', () => {
    const input = validExport() as unknown as {
      projects: Array<{ columns: Array<{ rank: unknown }> }>;
    };
    input.projects[0].columns[0].rank = 1024;
    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects Projects without valid start and Done workflow edges', () => {
    const input = validExport();
    input.projects[0].columns[0].category = 'in_progress';
    input.projects[0].columns.at(-1)!.category = 'in_progress';

    const result = workspaceExportSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'The first workflow column must be a start column',
          'The last workflow column must be Done',
        ])
      );
    }
  });

  it('rejects an export with no Projects', () => {
    const input = validExport();
    input.projects = [];

    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a null active Project', () => {
    const input = validExport() as unknown as {
      workspace: { activeProjectId: string | null };
    };
    input.workspace.activeProjectId = null;

    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('rejects an export whose only Project is archived', () => {
    const input = validExport();
    const project = input.projects[0] as unknown as { archivedAt: string | null };
    project.archivedAt = timestamp;

    expect(workspaceExportSchema.safeParse(input).success).toBe(false);
  });

  it('checks workflow edges by persisted rank instead of JSON array order', () => {
    const input = validExport();
    input.projects[0].columns[0].rank = '4096';
    input.projects[0].columns[1].rank = '1024';

    const result = workspaceExportSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'The first workflow column must be a start column',
          'The last workflow column must be Done',
        ])
      );
    }
  });

  it('rejects WIP on Done and an archived active Project', () => {
    const input = validExport();
    const project = input.projects[0] as unknown as {
      archivedAt: string | null;
      columns: Array<{ wipLimit: number | null }>;
    };
    project.columns.at(-1)!.wipLimit = 2;
    project.archivedAt = timestamp;

    const result = workspaceExportSchema.safeParse(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          'Done columns cannot have a WIP limit',
          'Active project cannot be archived',
        ])
      );
    }
  });
});
