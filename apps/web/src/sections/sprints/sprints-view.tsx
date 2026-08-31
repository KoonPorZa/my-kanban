'use client';

import type { SprintResponseDto, SprintListResponseDto } from '@my-kanban/api-client';

import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import {
  useGetBoard,
  useListSprints,
  useStartSprint,
  useCreateSprint,
  useListProjects,
  useUpdateProject,
  useCompleteSprint,
  useAddIssueToSprint,
  getGetBoardQueryKey,
  getListSprintsQueryKey,
  getListProjectsQueryKey,
  useRemoveIssueFromSprint,
} from '@my-kanban/api-client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { getQueryClient } from 'src/lib/query-client';
import { DashboardContent } from 'src/layouts/dashboard';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';

import { PlannedSprintCard } from './planned-sprint-card';
import { SprintHistoryList } from './sprint-history-list';
import { CreateSprintDialog } from './create-sprint-dialog';
import { ActiveSprintSummary } from './active-sprint-summary';
import { CompleteSprintDialog } from './complete-sprint-dialog';
import { SprintOverviewHeader } from './sprint-overview-header';

import type { CreateSprintFormValue } from './create-sprint-dialog';
import type { IncompleteWorkDestination } from './complete-sprint-dialog';

const initialForm = createInitialForm();

export function SprintsView() {
  const router = useRouter();
  const queryClient = getQueryClient();
  const historyRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState<CreateSprintFormValue>(initialForm);
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [startTargetId, setStartTargetId] = useState<string | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [destination, setDestination] = useState<IncompleteWorkDestination>({ type: 'backlog' });
  const [mutationError, setMutationError] = useState<string | null>(null);

  const projectsQuery = useListProjects({
    query: { staleTime: 30_000, refetchOnWindowFocus: true },
  });
  const projectId = projectsQuery.data?.activeProjectId ?? '';
  const project = projectsQuery.data?.projects.find((item) => item.id === projectId);
  const sprintsQuery = useListSprints(projectId, {
    query: {
      enabled: Boolean(projectId),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });
  const boardQuery = useGetBoard(projectId, undefined, {
    query: { enabled: Boolean(projectId), refetchOnWindowFocus: true },
  });

  const sprints = sprintsQuery.data?.sprints ?? [];
  const plannedSprints = sprints.filter((sprint) => sprint.status === 'planned');
  const activeSprint = sprints.find((sprint) => sprint.status === 'active') ?? null;
  const completedSprints = sprints.filter((sprint) => sprint.status === 'completed');
  const startTarget = plannedSprints.find((sprint) => sprint.id === startTargetId) ?? null;
  const selectedSprint = plannedSprints.find((sprint) => sprint.id === selectedSprintId) ?? null;
  const issues = boardQuery.data?.issues ?? [];
  const backlogIssues = issues.filter((issue) => issue.sprintId === null);
  const selectedIssues = selectedSprint
    ? issues.filter((issue) => issue.sprintId === selectedSprint.id)
    : [];
  const activeIssues = activeSprint
    ? issues.filter((issue) => issue.sprintId === activeSprint.id)
    : [];
  const doneColumnIds = new Set(
    boardQuery.data?.columns
      .filter((column) => column.category === 'done')
      .map((column) => column.id)
  );
  const completedActiveIssues = activeIssues.filter((issue) => doneColumnIds.has(issue.columnId));
  const activeCompletedPoints = sumPoints(completedActiveIssues);
  const activeIncompleteIssues = activeIssues.filter((issue) => !doneColumnIds.has(issue.columnId));
  const startTargetPoints = startTarget
    ? sumPoints(issues.filter((issue) => issue.sprintId === startTarget.id))
    : 0;

  const updateProjectMutation = useUpdateProject();
  const createMutation = useCreateSprint();
  const addMutation = useAddIssueToSprint();
  const removeMutation = useRemoveIssueFromSprint();
  const startMutation = useStartSprint();
  const completeMutation = useCompleteSprint();

  useEffect(() => {
    if (!plannedSprints.some((sprint) => sprint.id === selectedSprintId)) {
      setSelectedSprintId(plannedSprints[0]?.id ?? '');
    }
  }, [plannedSprints, selectedSprintId]);

  useEffect(() => {
    if (startTargetId && !plannedSprints.some((sprint) => sprint.id === startTargetId)) {
      setStartTargetId(null);
    }
  }, [plannedSprints, startTargetId]);

  const invalidate = async () => {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListSprintsQueryKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: getGetBoardQueryKey(projectId) }),
    ]);
  };

  const runMutation = async (operation: () => Promise<unknown>, successMessage: string) => {
    setMutationError(null);
    try {
      await operation();
      await invalidate();
      toast.success(successMessage);
      return true;
    } catch (error) {
      await invalidate();
      setMutationError(errorMessage(error));
      return false;
    }
  };

  const enableScrum = async () => {
    if (!project) return;
    const enabled = await runMutation(
      () =>
        updateProjectMutation.mutateAsync({
          projectId: project.id,
          data: { mode: 'scrum', version: project.version },
        }),
      'Project changed to Scrum'
    );
    if (enabled) router.push(paths.dashboard.kanban);
  };

  const switchToKanban = () => {
    if (!project || activeSprint) return;
    void runMutation(
      () =>
        updateProjectMutation.mutateAsync({
          projectId: project.id,
          data: { mode: 'kanban', version: project.version },
        }),
      'Project changed to Kanban'
    );
  };

  const createSprint = async () => {
    if (!projectId) return;
    const created = await runMutation(
      () => createMutation.mutateAsync({ projectId, data: createValue }),
      'Sprint created'
    );
    if (created) {
      setCreateOpen(false);
      setCreateValue(createInitialForm());
    }
  };

  const startSprint = async () => {
    if (!startTarget) return;
    const started = await runMutation(
      () =>
        startMutation.mutateAsync({
          sprintId: startTarget.id,
          data: { version: startTarget.version },
        }),
      'Sprint started'
    );
    if (started) {
      setStartTargetId(null);
      router.push(paths.dashboard.kanban);
      return;
    }

    const latest = queryClient.getQueryData<SprintListResponseDto>(
      getListSprintsQueryKey(projectId)
    );
    if (latest?.sprints.some((sprint) => sprint.status === 'active')) {
      setStartTargetId(null);
      router.push(paths.dashboard.kanban);
    }
  };

  const completeSprint = async () => {
    if (!activeSprint) return;
    const incompleteDestination = destination.type === 'backlog' ? 'backlog' : destination.sprintId;
    const completed = await runMutation(
      () =>
        completeMutation.mutateAsync({
          sprintId: activeSprint.id,
          data: { version: activeSprint.version, incompleteDestination },
        }),
      'Sprint completed'
    );
    if (completed) {
      setCompleteOpen(false);
      setDestination({ type: 'backlog' });
      requestAnimationFrame(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        historyRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const busy =
    updateProjectMutation.isPending ||
    createMutation.isPending ||
    addMutation.isPending ||
    removeMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending;
  const loading = projectsQuery.isLoading || sprintsQuery.isLoading || boardQuery.isLoading;
  const loadError = projectsQuery.error ?? sprintsQuery.error ?? boardQuery.error;
  const hasPlanningData = Boolean(project && sprintsQuery.data && boardQuery.data);

  const retryLoad = () => {
    void Promise.all([projectsQuery.refetch(), sprintsQuery.refetch(), boardQuery.refetch()]);
  };

  if (loading) {
    return (
      <DashboardContent maxWidth="xl">
        <Box sx={{ minHeight: 360, display: 'grid', placeItems: 'center' }}>
          <CircularProgress aria-label="Loading Sprints" />
        </Box>
      </DashboardContent>
    );
  }

  if (!project || (loadError && !hasPlanningData)) {
    return (
      <DashboardContent maxWidth="xl">
        <Alert severity="error">{loadError ? errorMessage(loadError) : 'No active Project.'}</Alert>
      </DashboardContent>
    );
  }

  return (
    <DashboardContent maxWidth="xl">
      <SprintOverviewHeader
        projectName={project.name}
        activeSprintName={activeSprint?.name}
        plannedSprintCount={plannedSprints.length}
        createDisabled={project.mode !== 'scrum'}
        onCreateSprint={() => setCreateOpen(true)}
      />

      {loadError && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={retryLoad}>
              Retry
            </Button>
          }
          sx={{ mt: 3 }}
        >
          Could not refresh planning data. Last loaded data is shown.
        </Alert>
      )}

      {mutationError && (
        <Alert severity="error" onClose={() => setMutationError(null)} sx={{ mt: 3 }}>
          {mutationError}
        </Alert>
      )}

      {project.mode === 'kanban' ? (
        <Alert
          severity="info"
          icon={<Iconify icon="solar:calendar-date-bold" />}
          action={
            <Button
              color="info"
              variant="contained"
              loading={updateProjectMutation.isPending}
              onClick={() => void enableScrum()}
            >
              Enable Scrum
            </Button>
          }
          sx={{ mt: 3 }}
        >
          Switch this Project to Scrum before creating a Sprint. Existing Board tasks remain in the
          backlog until you assign them.
        </Alert>
      ) : (
        <Stack spacing={3} sx={{ mt: 3 }}>
          {activeSprint && (
            <>
              <ActiveSprintSummary
                name={activeSprint.name}
                goal={activeSprint.goal}
                startDate={activeSprint.startDate}
                endDate={activeSprint.endDate}
                totalIssueCount={activeIssues.length}
                completedIssueCount={completedActiveIssues.length}
                plannedPoints={activeSprint.plannedPoints}
                completedPoints={activeCompletedPoints}
                loading={completeMutation.isPending}
                onComplete={() => setCompleteOpen(true)}
                onOpenBoard={() => router.push(paths.dashboard.kanban)}
              />
              <PlanningPanel
                sprint={activeSprint}
                backlogIssues={backlogIssues}
                assignedIssues={activeIssues}
                busy={busy}
                onAdd={(issueId) =>
                  void runMutation(
                    () =>
                      addMutation.mutateAsync({
                        sprintId: activeSprint.id,
                        data: { issueId },
                      }),
                    'Task added to active Sprint'
                  )
                }
                onRemove={(issueId) =>
                  void runMutation(
                    () => removeMutation.mutateAsync({ sprintId: activeSprint.id, issueId }),
                    'Task moved to backlog'
                  )
                }
              />
            </>
          )}

          <Box
            sx={{
              gap: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            }}
          >
            {plannedSprints.map((sprint) => (
              <PlannedSprintCard
                key={sprint.id}
                name={sprint.name}
                goal={sprint.goal || 'No goal set.'}
                startDate={sprint.startDate}
                endDate={sprint.endDate}
                issueCount={sprint.issueCount}
                plannedPoints={sumPoints(issues.filter((issue) => issue.sprintId === sprint.id))}
                loading={startMutation.isPending && startTargetId === sprint.id}
                canStart={sprint.issueCount > 0 && !activeSprint}
                startDisabledReason={
                  activeSprint
                    ? 'Complete the active Sprint before starting another Sprint.'
                    : 'Add at least one issue before starting this Sprint.'
                }
                onOpen={() => setSelectedSprintId(sprint.id)}
                onStart={() => setStartTargetId(sprint.id)}
              />
            ))}
          </Box>

          {plannedSprints.length === 0 && (
            <EmptyContent
              filled
              title="No planned Sprint"
              description="Create a Sprint, then add at least one backlog issue before starting."
              action={
                <Button variant="contained" onClick={() => setCreateOpen(true)} sx={{ mt: 3 }}>
                  Create Sprint
                </Button>
              }
              sx={{ py: 8 }}
            />
          )}

          {selectedSprint && (
            <PlanningPanel
              sprint={selectedSprint}
              backlogIssues={backlogIssues}
              assignedIssues={selectedIssues}
              busy={busy}
              onAdd={(issueId) =>
                void runMutation(
                  () =>
                    addMutation.mutateAsync({
                      sprintId: selectedSprint.id,
                      data: { issueId },
                    }),
                  'Task added to Sprint'
                )
              }
              onRemove={(issueId) =>
                void runMutation(
                  () => removeMutation.mutateAsync({ sprintId: selectedSprint.id, issueId }),
                  'Task moved to backlog'
                )
              }
            />
          )}

          <Box ref={historyRef} tabIndex={-1} sx={{ scrollMarginTop: 24, outline: 'none' }}>
            <SprintHistoryList
              sprints={completedSprints.map((sprint) => ({
                id: sprint.id,
                name: sprint.name,
                goal: sprint.goal || 'No goal set.',
                startDate: sprint.startDate,
                endDate: sprint.endDate,
                completedAt: sprint.completedAt ?? sprint.updatedAt,
                issueCount: sprint.plannedIssueCount,
                completedIssueCount: sprint.completedIssueCount,
                incompleteIssueCount: sprint.incompleteIssueCount,
                plannedPoints: sprint.plannedPoints,
                completedPoints: sprint.completedPoints,
                incompletePoints: sprint.incompletePoints,
              }))}
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
            {activeSprint && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Complete the active Sprint before switching to Kanban.
              </Typography>
            )}
            <Button
              color="inherit"
              variant="outlined"
              disabled={Boolean(activeSprint) || updateProjectMutation.isPending}
              onClick={switchToKanban}
            >
              Switch to Kanban
            </Button>
          </Box>
        </Stack>
      )}

      <CreateSprintDialog
        open={createOpen}
        value={createValue}
        loading={createMutation.isPending}
        error={mutationError}
        onClose={() => setCreateOpen(false)}
        onChange={(field, value) => setCreateValue((current) => ({ ...current, [field]: value }))}
        onSubmit={() => void createSprint()}
      />

      <ConfirmDialog
        open={Boolean(startTarget)}
        title={`Start ${startTarget?.name ?? 'Sprint'}?`}
        content={`${startTarget?.issueCount ?? 0} issues and ${startTargetPoints} Story Points will be captured as the Sprint plan.`}
        onClose={() => {
          if (!startMutation.isPending) setStartTargetId(null);
        }}
        disableEscapeKeyDown={startMutation.isPending}
        cancelDisabled={startMutation.isPending}
        action={
          <Button variant="contained" loading={startMutation.isPending} onClick={startSprint}>
            Start Sprint
          </Button>
        }
      />

      {activeSprint && (
        <CompleteSprintDialog
          open={completeOpen}
          sprintName={activeSprint.name}
          completedPoints={activeCompletedPoints}
          completedIssueCount={completedActiveIssues.length}
          incompletePoints={sumPoints(activeIncompleteIssues)}
          incompleteIssueCount={activeIncompleteIssues.length}
          destination={destination}
          plannedSprints={plannedSprints.map((sprint) => ({ id: sprint.id, name: sprint.name }))}
          loading={completeMutation.isPending}
          error={mutationError}
          onClose={() => setCompleteOpen(false)}
          onComplete={() => void completeSprint()}
          onDestinationChange={setDestination}
        />
      )}
    </DashboardContent>
  );
}

type PlanningIssue = {
  id: string;
  title: string;
  storyPoints: number | null;
};

function PlanningPanel({
  sprint,
  backlogIssues,
  assignedIssues,
  busy,
  onAdd,
  onRemove,
}: {
  sprint: SprintResponseDto;
  backlogIssues: PlanningIssue[];
  assignedIssues: PlanningIssue[];
  busy: boolean;
  onAdd: (issueId: string) => void;
  onRemove: (issueId: string) => void;
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6">
          {sprint.status === 'active' ? 'Manage' : 'Plan'} {sprint.name}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {assignedIssues.length} issues · {sumPoints(assignedIssues)} points selected
        </Typography>
      </CardContent>
      <Divider />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <IssueList
          title="Backlog"
          empty="No backlog issues"
          issues={backlogIssues}
          actionLabel="Add"
          busy={busy}
          onAction={onAdd}
        />
        <IssueList
          title="Sprint scope"
          empty="Add at least one issue before starting this Sprint."
          issues={assignedIssues}
          actionLabel="Remove"
          busy={busy}
          onAction={onRemove}
          sx={{ borderLeft: { md: '1px solid' }, borderColor: { md: 'divider' } }}
        />
      </Box>
    </Card>
  );
}

function IssueList({
  title,
  empty,
  issues,
  actionLabel,
  busy,
  onAction,
  sx,
}: {
  title: string;
  empty: string;
  issues: PlanningIssue[];
  actionLabel: string;
  busy: boolean;
  onAction: (issueId: string) => void;
  sx?: object;
}) {
  return (
    <Box sx={{ p: 3, ...sx }}>
      <Typography variant="subtitle1">{title}</Typography>
      {issues.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          {empty}
        </Typography>
      ) : (
        <Stack divider={<Divider flexItem />} sx={{ mt: 1 }}>
          {issues.map((issue) => (
            <Box key={issue.id} sx={{ py: 1.5, gap: 2, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap>
                  {issue.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {issue.storyPoints ?? 0} points
                </Typography>
              </Box>
              <Button
                size="small"
                disabled={busy}
                aria-label={`${actionLabel} ${issue.title}`}
                onClick={() => onAction(issue.id)}
                sx={{ minHeight: 44 }}
              >
                {actionLabel}
              </Button>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function sumPoints(issues: Array<{ storyPoints: number | null }>) {
  return issues.reduce((total, issue) => total + (issue.storyPoints ?? 0), 0);
}

function createInitialForm(): CreateSprintFormValue {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return {
    name: '',
    goal: '',
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function errorMessage(error: unknown) {
  if (isAxiosError(error) && error.response?.status === 409) {
    const payload = error.response.data as
      { error?: { code?: string; message?: string } } | undefined;
    if (payload?.error?.code === 'conflict' && payload.error.message) {
      return payload.error.message;
    }
    return 'This Sprint changed elsewhere. Review the latest data and try again.';
  }
  if (error instanceof Error) return error.message;
  return 'Could not save changes. Try again.';
}
