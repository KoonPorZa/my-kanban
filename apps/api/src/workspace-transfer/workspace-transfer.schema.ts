import { z } from 'zod';

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const rank = z.string().regex(/^-?\d+$/, 'Rank must be an integer encoded as a string');

const checklistItemSchema = z
  .object({
    id: uuid,
    title: z.string().min(1).max(300),
    isCompleted: z.boolean(),
    rank,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const columnSchema = z
  .object({
    id: uuid,
    name: z.string().min(1).max(80),
    category: z.enum(['todo', 'in_progress', 'done']),
    rank,
    wipLimit: z.number().int().positive().nullable(),
    version: z.number().int().positive(),
    archivedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const sprintSchema = z
  .object({
    id: uuid,
    name: z.string().min(1).max(120),
    goal: z.string().max(500),
    status: z.enum(['planned', 'active', 'completed']),
    startDate: dateOnly,
    endDate: dateOnly,
    plannedPoints: z.number().int().nonnegative(),
    plannedIssueCount: z.number().int().nonnegative(),
    completedPoints: z.number().int().nonnegative(),
    completedIssueCount: z.number().int().nonnegative(),
    incompletePoints: z.number().int().nonnegative(),
    incompleteIssueCount: z.number().int().nonnegative(),
    completedAt: isoDateTime.nullable(),
    version: z.number().int().positive(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const issueSchema = z
  .object({
    id: uuid,
    sprintId: uuid.nullable(),
    columnId: uuid,
    title: z.string().min(1).max(200),
    description: z.string(),
    type: z.enum(['task', 'story', 'bug', 'chore']),
    priority: z.enum(['urgent', 'high', 'medium', 'low', 'none']),
    labels: z.array(z.string()),
    storyPoints: z.number().int().min(0).max(100).nullable(),
    rank,
    version: z.number().int().positive(),
    dueDate: isoDateTime.nullable(),
    isBlocked: z.boolean(),
    blockedReason: z.string().nullable(),
    archivedAt: isoDateTime.nullable(),
    completedAt: isoDateTime.nullable(),
    checklist: z.array(checklistItemSchema),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

const projectSchema = z
  .object({
    id: uuid,
    name: z.string().min(1).max(120),
    color: z.string().min(1).max(32),
    mode: z.enum(['kanban', 'scrum']),
    doneRetentionDays: z
      .number()
      .int()
      .refine((value) => [7, 14, 30].includes(value), 'Retention must be 7, 14, or 30 days'),
    version: z.number().int().positive(),
    archivedAt: isoDateTime.nullable(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    columns: z.array(columnSchema),
    sprints: z.array(sprintSchema),
    issues: z.array(issueSchema),
  })
  .strict()
  .superRefine((project, context) => {
    const activeColumns = project.columns
      .map((column, index) => ({ column, index, rank: BigInt(column.rank) }))
      .filter(({ column }) => column.archivedAt === null)
      .sort((left, right) => (left.rank < right.rank ? -1 : left.rank > right.rank ? 1 : 0));
    if (!activeColumns.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['columns'],
        message: 'Project must include at least one active workflow column',
      });
    } else {
      const first = activeColumns[0];
      const last = activeColumns.at(-1)!;
      if (first.column.category !== 'todo') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['columns', first.index, 'category'],
          message: 'The first workflow column must be a start column',
        });
      }
      if (last.column.category !== 'done') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['columns', last.index, 'category'],
          message: 'The last workflow column must be Done',
        });
      }
      for (let index = 1; index < activeColumns.length; index += 1) {
        if (activeColumns[index - 1].rank === activeColumns[index].rank) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['columns', activeColumns[index].index, 'rank'],
            message: 'Active workflow column ranks must be unique',
          });
        }
      }
    }
    for (const [index, column] of project.columns.entries()) {
      if (column.category === 'done' && column.wipLimit !== null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['columns', index, 'wipLimit'],
          message: 'Done columns cannot have a WIP limit',
        });
      }
    }
    const columnIds = new Set(project.columns.map((column) => column.id));
    const sprintIds = new Set(project.sprints.map((sprint) => sprint.id));
    for (const issue of project.issues) {
      if (!columnIds.has(issue.columnId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['issues'],
          message: `Task ${issue.id} references a column outside its project`,
        });
      }
      if (issue.sprintId && !sprintIds.has(issue.sprintId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['issues'],
          message: `Task ${issue.id} references a Sprint outside its project`,
        });
      }
    }
  });

export const workspaceExportSchema = z
  .object({
    schemaVersion: z.literal(1),
    exportedAt: isoDateTime,
    workspace: z
      .object({
        name: z.string().min(1).max(120),
        activeProjectId: uuid,
        version: z.number().int().positive(),
        createdAt: isoDateTime,
        updatedAt: isoDateTime,
      })
      .strict(),
    projects: z.array(projectSchema).min(1, 'Workspace export must include at least one Project'),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const projectIds = new Set(value.projects.map((project) => project.id));
    for (const project of value.projects) {
      for (const id of [
        project.id,
        ...project.columns.map((column) => column.id),
        ...project.sprints.map((sprint) => sprint.id),
        ...project.issues.map((issue) => issue.id),
        ...project.issues.flatMap((issue) => issue.checklist.map((item) => item.id)),
      ]) {
        if (ids.has(id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['projects'],
            message: `Duplicate entity id: ${id}`,
          });
        }
        ids.add(id);
      }
    }
    if (!projectIds.has(value.workspace.activeProjectId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['workspace', 'activeProjectId'],
        message: 'Active project must be included in the export',
      });
    }
    const activeProject = value.projects.find(
      (project) => project.id === value.workspace.activeProjectId
    );
    if (activeProject?.archivedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['workspace', 'activeProjectId'],
        message: 'Active project cannot be archived',
      });
    }
  });

export type WorkspaceExport = z.infer<typeof workspaceExportSchema>;
