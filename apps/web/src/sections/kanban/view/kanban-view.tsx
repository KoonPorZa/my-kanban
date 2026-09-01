'use client';

import type { IKanbanTask } from 'src/types/kanban';
import type {
  DragEndEvent,
  Announcements,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
  CollisionDetection,
  ScreenReaderInstructions,
} from '@dnd-kit/core';

import { useRouter } from 'next/navigation';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSensor,
  DndContext,
  useSensors,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  closestCorners,
  KeyboardSensor,
  getFirstCollision,
  MeasuringStrategy,
} from '@dnd-kit/core';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { useUndoAction } from 'src/hooks/use-undo-action';

import { DashboardContent } from 'src/layouts/dashboard';
import {
  moveColumn,
  useGetBoard,
  refetchBoard,
  undoTaskMove,
  previewTaskMove,
  persistTaskMove,
} from 'src/actions/kanban';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { kanbanClasses } from '../classes';
import { coordinateGetter } from '../utils';
import { KanbanMobileColumnSelect } from '../mobile';
import { KanbanColumn } from '../column/kanban-column';
import { KanbanTaskItem } from '../item/kanban-task-item';
import { KanbanColumnAdd } from '../column/kanban-column-add';
import { ProjectSwitcher } from '../components/project-switcher';
import { KanbanColumnSkeleton } from '../components/kanban-skeleton';
import { KanbanDataWarning } from '../components/kanban-data-warning';
import { KanbanDragOverlay } from '../components/kanban-drag-overlay';
import {
  projectBoard,
  collectBoardLabels,
  countActiveFilters,
  KanbanFilterToolbar,
  DEFAULT_BOARD_FILTERS,
  type BoardFilterState,
  applyProjectDoneRetention,
} from '../filters';

// ----------------------------------------------------------------------

const PLACEHOLDER_ID = 'placeholder';
const BOARD_PREFERENCES_KEY = 'my-kanban:board-preferences';

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To pick up a task or column, press Space. While dragging, use the arrow keys to move it. Press Space again to drop, or Escape to cancel.',
};

const cssVars = {
  '--item-gap': '16px',
  '--item-radius': '12px',
  '--column-gap': '24px',
  '--column-width': '336px',
  '--column-radius': '16px',
  '--column-padding': '20px 16px 16px 16px',
};

// ----------------------------------------------------------------------

export function KanbanView() {
  const router = useRouter();
  const {
    board,
    boardLoading,
    boardEmpty,
    boardError,
    projectMode,
    activeSprint,
    sprintOptions,
    doneRetentionDays,
  } = useGetBoard();
  const isMobile = useMediaQuery('(max-width:767.95px)');

  const recentlyMovedToNewContainer = useRef(false);
  const lastOverId = useRef<UniqueIdentifier>(null);
  const dragOrigin = useRef<{
    task: IKanbanTask;
    columnId: UniqueIdentifier;
    orderedTasks: IKanbanTask[];
  } | null>(null);

  const [columnFixed, setColumnFixed] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [mobileColumnId, setMobileColumnId] = useState('');
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [filters, setFilters] = useState<BoardFilterState>(DEFAULT_BOARD_FILTERS);
  const showUndoAction = useUndoAction();

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(BOARD_PREFERENCES_KEY) ?? '{}') as {
        showOlderDone?: boolean;
      };

      setFilters((current) => ({
        ...current,
        showOlderDone: Boolean(stored.showOlderDone),
      }));
    } catch {
      // Use the default preference when storage is unavailable or invalid.
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!preferencesReady || !board.projectId) return;

    setFilters((current) => applyProjectDoneRetention(current, doneRetentionDays));
  }, [board.projectId, doneRetentionDays, preferencesReady]);

  useEffect(() => {
    if (!preferencesReady) return;

    try {
      window.localStorage.setItem(
        BOARD_PREFERENCES_KEY,
        JSON.stringify({
          showOlderDone: filters.showOlderDone,
        })
      );
    } catch {
      // The Board remains usable when storage is unavailable (for example, private mode policies).
    }
  }, [filters.showOlderDone, preferencesReady]);

  useEffect(() => {
    if (!board.columns.length) {
      setMobileColumnId('');
      return;
    }

    if (!board.columns.some((column) => String(column.id) === mobileColumnId)) {
      setMobileColumnId(String(board.columns[0].id));
    }
  }, [board.columns, mobileColumnId]);

  const activeFilterCount = countActiveFilters(filters, doneRetentionDays);
  const projectedBoard = useMemo(
    () =>
      projectBoard(board, filters, {
        mobileColumnId: isMobile ? mobileColumnId || undefined : undefined,
      }),
    [board, filters, isMobile, mobileColumnId]
  );
  const resultCount = Object.values(projectedBoard.tasks).reduce(
    (total, tasks) => total + tasks.length,
    0
  );
  const boardTaskCount = Object.values(board.tasks).reduce(
    (total, tasks) => total + tasks.length,
    0
  );
  const projectionActive = activeFilterCount > 0 || resultCount !== boardTaskCount || isMobile;

  const columnIds = projectedBoard.columns.map((column) => column.id);
  const visibleTasks = Object.values(board.tasks).flat();
  const currentSprintPoints = visibleTasks.reduce(
    (total, task) => total + (task.storyPoints ?? 0),
    0
  );
  const activeSprintEmpty =
    projectMode === 'scrum' && Boolean(activeSprint) && !visibleTasks.length;
  const hasRenderableBoard =
    Boolean(board.projectId) && (projectMode !== 'scrum' || Boolean(activeSprint));

  const isSortingContainer = activeId != null ? columnIds.includes(activeId) : false;

  const describeItem = useCallback(
    (id: UniqueIdentifier) => {
      const column = board.columns.find((item) => item.id === id);
      if (column) return `column ${column.name}`;

      return (
        Object.values(board.tasks)
          .flat()
          .find((task) => task.id === id)?.name ?? `item ${String(id)}`
      );
    },
    [board.columns, board.tasks]
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${describeItem(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${describeItem(active.id)} is over ${describeItem(over.id)}.`
          : `${describeItem(active.id)} is no longer over a drop target.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `Dropped ${describeItem(active.id)} at ${describeItem(over.id)}.`
          : `Drop cancelled for ${describeItem(active.id)}.`,
      onDragCancel: ({ active }) => `Dragging cancelled for ${describeItem(active.id)}.`,
    }),
    [describeItem]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 3px pixels before activating
      activationConstraint: { distance: 3 },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      if (activeId && activeId in projectedBoard.tasks) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (column) => column.id in projectedBoard.tasks
          ),
        });
      }

      // Start by finding any intersecting droppable
      const pointerIntersections = pointerWithin(args);
      const cornersCollisions = closestCorners(args);
      const centerCollisions = closestCenter(args);

      // OLD
      // const intersections = pointerIntersections.length > 0 ? pointerIntersections : rectIntersection(args);

      // NEW
      // https://github.com/clauderic/dnd-kit/issues/900#issuecomment-2068314434
      const intersections =
        !!pointerIntersections.length && !!centerCollisions.length && !!cornersCollisions.length
          ? pointerIntersections
          : null;

      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        if (overId in projectedBoard.tasks) {
          const columnItems = projectedBoard.tasks[overId].map((task) => task.id);

          // If a column is matched and it contains items (columns 'A', 'B', 'C')
          if (columnItems.length > 0) {
            // Return the closest droppable within that column
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (column) => column.id !== overId && columnItems.includes(column.id)
              ),
            })[0]?.id;
          }
        }

        lastOverId.current = overId;

        return [{ id: overId }];
      }

      // When a draggable item moves to a new column, the layout may shift
      // and the `overId` may become `null`. We manually set the cached `lastOverId`
      // to the id of the draggable item that was moved to the new column, otherwise
      // the previous `overId` will be returned which can cause items to incorrectly shift positions
      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId;
      }

      // If no droppable is matched, return the last match
      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [activeId, projectedBoard.tasks]
  );

  const findColumn = (id: UniqueIdentifier) => {
    if (id in projectedBoard.tasks) {
      return id;
    }

    return Object.keys(projectedBoard.tasks).find((key) =>
      projectedBoard.tasks[key].map((task) => task.id).includes(id)
    );
  };

  const persistConfirmedTaskMove = async (
    task: (typeof visibleTasks)[number],
    sourceColumnId: UniqueIdentifier,
    targetColumnId: UniqueIdentifier,
    orderedTasks: (typeof visibleTasks)[number][]
  ) => {
    const sourceColumn = board.columns.find(({ id }) => id === sourceColumnId);
    const targetColumn = board.columns.find(({ id }) => id === targetColumnId);
    const incompleteCount =
      task.checklistIncompleteCount ??
      (task.checklist ?? []).filter((item) => !item.isCompleted).length;
    const needsConfirmation =
      sourceColumn?.category !== 'done' && targetColumn?.category === 'done' && incompleteCount > 0;

    if (
      needsConfirmation &&
      !window.confirm(
        `This task has ${incompleteCount} incomplete checklist item(s). Move it to Done anyway?`
      )
    ) {
      return false;
    }

    return persistTaskMove(board.projectId, task, targetColumnId, orderedTasks, needsConfirmation);
  };

  const offerMoveUndo = (
    task: (typeof visibleTasks)[number],
    movedVersion: number,
    sourceColumnId: UniqueIdentifier,
    originalOrderedTasks: (typeof visibleTasks)[number][]
  ) => {
    showUndoAction({
      message: 'Task moved',
      successMessage: 'Task move undone',
      errorMessage: 'Could not undo the move. The Board was refreshed.',
      undo: () =>
        undoTaskMove(board.projectId, task, movedVersion, sourceColumnId, originalOrderedTasks),
    });
  };

  const moveTaskToAdjacentColumn = async (
    task: (typeof visibleTasks)[number],
    sourceColumnId: UniqueIdentifier,
    targetColumnId: UniqueIdentifier
  ) => {
    try {
      const originalOrderedTasks = [...(board.tasks[sourceColumnId] ?? [])];
      const moved = await persistConfirmedTaskMove(task, sourceColumnId, targetColumnId, [
        ...(board.tasks[targetColumnId] ?? []),
        task,
      ]);
      if (moved) offerMoveUndo(task, moved.version, sourceColumnId, originalOrderedTasks);
    } catch (error) {
      console.error(error);
      toast.error('Could not move task. The Board was refreshed.');
    }
  };

  const adjacentColumnId = (columnId: UniqueIdentifier, offset: -1 | 1) => {
    const index = board.columns.findIndex(({ id }) => id === columnId);
    return board.columns[index + offset]?.id;
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, []);

  /**
   * onDragStart
   */
  const onDragStart = ({ active }: DragStartEvent) => {
    if (projectionActive) return;
    const sourceColumnId = findColumn(active.id);
    const task = sourceColumnId
      ? board.tasks[sourceColumnId]?.find((item) => item.id === active.id)
      : undefined;
    dragOrigin.current =
      sourceColumnId && task
        ? { task, columnId: sourceColumnId, orderedTasks: [...board.tasks[sourceColumnId]] }
        : null;
    setActiveId(active.id);
  };

  const onDragCancel = () => {
    dragOrigin.current = null;
    setActiveId(null);
  };

  /**
   * onDragOver
   */
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (projectionActive) return;
    const overId = over?.id;

    if (overId == null || active.id in board.tasks) {
      return;
    }

    const overColumn = findColumn(overId);
    const activeColumn = findColumn(active.id);

    if (!overColumn || !activeColumn) {
      return;
    }

    if (activeColumn !== overColumn) {
      const activeItems = board.tasks[activeColumn].map((task) => task.id);
      const overItems = board.tasks[overColumn].map((task) => task.id);
      const overIndex = overItems.indexOf(overId);
      const activeIndex = activeItems.indexOf(active.id);

      let newIndex: number;

      if (overId in board.tasks) {
        newIndex = overItems.length + 1;
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height;

        const modifier = isBelowOverItem ? 1 : 0;

        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
      }

      recentlyMovedToNewContainer.current = true;

      const updateTasks = {
        ...board.tasks,
        [activeColumn]: board.tasks[activeColumn].filter((task) => task.id !== active.id),
        [overColumn]: [
          ...board.tasks[overColumn].slice(0, newIndex),
          board.tasks[activeColumn][activeIndex],
          ...board.tasks[overColumn].slice(newIndex, board.tasks[overColumn].length),
        ],
      };

      previewTaskMove(board.projectId, updateTasks);
    }
  };

  /**
   * onDragEnd
   */
  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (projectionActive) {
      dragOrigin.current = null;
      setActiveId(null);
      return;
    }
    if (active.id in board.tasks && over?.id) {
      const activeIndex = columnIds.indexOf(active.id);
      const overIndex = columnIds.indexOf(over.id);
      const updateColumns = arrayMove(board.columns, activeIndex, overIndex);
      const movedColumn = board.columns.find((column) => column.id === active.id);

      if (movedColumn) {
        try {
          await moveColumn(board.projectId, movedColumn, updateColumns);
        } catch (error) {
          console.error(error);
          toast.error('Could not move column. The Board was refreshed.');
        }
      }

      setActiveId(null);
      dragOrigin.current = null;
      return;
    }

    const activeColumn = findColumn(active.id);

    if (!activeColumn) {
      dragOrigin.current = null;
      setActiveId(null);
      return;
    }

    const overId = over?.id;

    if (overId == null) {
      dragOrigin.current = null;
      setActiveId(null);
      return;
    }

    const overColumn = findColumn(overId);

    if (overColumn) {
      const activeTask = board.tasks[activeColumn].find((task) => task.id === active.id);
      const activeContainerTaskIds = board.tasks[activeColumn].map((task) => task.id);
      const overContainerTaskIds = board.tasks[overColumn].map((task) => task.id);

      const activeIndex = activeContainerTaskIds.indexOf(active.id);
      const overIndex = overContainerTaskIds.indexOf(overId);

      let updateTasks = board.tasks;

      if (overIndex >= 0 && activeIndex !== overIndex) {
        updateTasks = {
          ...board.tasks,
          [overColumn]: arrayMove(board.tasks[overColumn], activeIndex, overIndex),
        };
        previewTaskMove(board.projectId, updateTasks);
      }

      if (activeTask) {
        try {
          const origin = dragOrigin.current;
          const moved = await persistConfirmedTaskMove(
            activeTask,
            origin?.columnId ?? activeColumn,
            overColumn,
            updateTasks[overColumn]
          );
          if (!moved) {
            await refetchBoard(board.projectId);
          } else if (origin) {
            offerMoveUndo(origin.task, moved.version, origin.columnId, origin.orderedTasks);
          }
        } catch (error) {
          console.error(error);
          toast.error('Could not move task. The Board was refreshed.');
        }
      }
    }

    dragOrigin.current = null;
    setActiveId(null);
  };

  const renderLoading = () => (
    <Box sx={{ gap: 'var(--column-gap)', display: 'flex', alignItems: 'flex-start' }}>
      <KanbanColumnSkeleton />
    </Box>
  );

  const renderEmpty = () => <EmptyContent filled sx={{ py: 10, maxHeight: { md: 480 } }} />;

  const renderList = () => (
    <DndContext
      id="dnd-kanban"
      sensors={projectionActive ? [] : sensors}
      accessibility={{ announcements, screenReaderInstructions }}
      collisionDetection={collisionDetectionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <Stack sx={{ flex: '1 1 auto', overflowX: 'auto' }}>
        <Stack
          sx={{
            pb: 3,
            display: 'unset',
            ...(columnFixed && { minHeight: 0, display: 'flex', flex: '1 1 auto' }),
          }}
        >
          <Box
            sx={[
              (theme) => ({
                display: 'flex',
                gap: 'var(--column-gap)',
                ...(columnFixed && {
                  minHeight: 0,
                  flex: '1 1 auto',
                  [`& .${kanbanClasses.columnList}`]: {
                    ...theme.mixins.hideScrollY,
                    flex: '1 1 auto',
                  },
                }),
              }),
            ]}
          >
            <SortableContext
              items={[...columnIds, PLACEHOLDER_ID]}
              strategy={horizontalListSortingStrategy}
            >
              {projectedBoard.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  projectId={board.projectId}
                  scrumMode={projectMode === 'scrum'}
                  column={column}
                  tasks={projectedBoard.tasks[column.id]}
                  disabled={projectionActive}
                >
                  <SortableContext
                    items={projectedBoard.tasks[column.id]}
                    strategy={verticalListSortingStrategy}
                  >
                    {projectedBoard.tasks[column.id].map((task) => (
                      <KanbanTaskItem
                        key={task.id}
                        projectId={board.projectId}
                        task={task}
                        disabled={projectionActive || isSortingContainer}
                        onMovePrevious={
                          adjacentColumnId(column.id, -1)
                            ? () =>
                                moveTaskToAdjacentColumn(
                                  task,
                                  column.id,
                                  adjacentColumnId(column.id, -1)!
                                )
                            : undefined
                        }
                        onMoveNext={
                          adjacentColumnId(column.id, 1)
                            ? () =>
                                moveTaskToAdjacentColumn(
                                  task,
                                  column.id,
                                  adjacentColumnId(column.id, 1)!
                                )
                            : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                </KanbanColumn>
              ))}

              {!projectionActive && (
                <KanbanColumnAdd id={PLACEHOLDER_ID} projectId={board.projectId} />
              )}
            </SortableContext>
          </Box>
        </Stack>
      </Stack>

      <KanbanDragOverlay
        columns={projectedBoard.columns}
        tasks={projectedBoard.tasks}
        activeId={activeId}
        sx={cssVars}
      />
    </DndContext>
  );

  return (
    <DashboardContent
      maxWidth={false}
      sx={{
        ...cssVars,
        pb: 0,
        pl: { sm: 3 },
        pr: { sm: 0 },
        flex: '1 1 0',
        display: 'flex',
        overflow: 'hidden',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          pr: { sm: 3 },
          mb: { xs: 3, md: 5 },
          display: 'flex',
          gap: 2,
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h4">{board.projectName || 'Kanban'}</Typography>
            {activeSprint && (
              <Label color="success" variant="soft">
                {activeSprint.name}
              </Label>
            )}
          </Box>
          {activeSprint && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 0.25, sm: 1 }}
              sx={{ mt: 0.75, color: 'text.secondary' }}
            >
              <Typography variant="caption">
                {activeSprint.startDate} — {activeSprint.endDate}
              </Typography>
              <Typography variant="caption">
                {visibleTasks.length} issues · {currentSprintPoints} current points ·{' '}
                {activeSprint.plannedPoints} planned points
              </Typography>
              {activeSprint.goal && (
                <Typography variant="caption" sx={{ maxWidth: 480 }} noWrap>
                  Goal: {activeSprint.goal}
                </Typography>
              )}
            </Stack>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: { xs: 'space-between', md: 'flex-end' } }}
        >
          <ProjectSwitcher />
          {activeSprint && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Iconify icon="solar:add-circle-bold" />}
              onClick={() => router.push(paths.dashboard.sprints)}
            >
              Add from backlog
            </Button>
          )}
          <FormControlLabel
            label="Fixed column"
            labelPlacement="start"
            control={
              <Switch
                checked={columnFixed}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setColumnFixed(event.target.checked);
                }}
                slotProps={{ input: { id: 'fixed-column-switch' } }}
              />
            }
          />
        </Stack>
      </Box>

      {boardError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()}>
              Retry
            </Button>
          }
          sx={{ mr: { sm: 3 }, mb: 2 }}
        >
          Could not refresh the Board. Last loaded data is shown when available.
        </Alert>
      )}

      <KanbanDataWarning skippedIssueCount={board.skippedIssueCount} />

      {hasRenderableBoard && !boardLoading && (
        <>
          <KanbanFilterToolbar
            value={filters}
            labels={collectBoardLabels(board)}
            sprints={sprintOptions}
            activeCount={activeFilterCount}
            resultCount={resultCount}
            onChange={setFilters}
            onClear={() =>
              setFilters(applyProjectDoneRetention(DEFAULT_BOARD_FILTERS, doneRetentionDays))
            }
          />
          {isMobile && (
            <KanbanMobileColumnSelect
              columns={board.columns}
              value={mobileColumnId}
              onChange={setMobileColumnId}
            />
          )}
          {projectionActive && (
            <Alert severity="info" sx={{ mr: { sm: 3 }, mb: 2 }}>
              Drag and drop is paused in filtered and one-column views. Clear filters or use a wider
              screen to reorder work safely.
            </Alert>
          )}
        </>
      )}

      {boardError && !hasRenderableBoard ? null : boardLoading ? (
        renderLoading()
      ) : projectMode === 'scrum' && !activeSprint ? (
        <EmptyContent
          filled
          title="No active Sprint"
          description="Plan a Sprint and add at least one issue to start."
          sx={{ py: 10, maxHeight: { md: 480 } }}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:calendar-date-bold" />}
              onClick={() => router.push(paths.dashboard.sprints)}
              sx={{ mt: 3 }}
            >
              Plan Sprint
            </Button>
          }
        />
      ) : activeSprintEmpty ? (
        <EmptyContent
          filled
          title="Active Sprint is empty"
          description="Add work from the backlog to continue this Sprint."
          sx={{ py: 10, maxHeight: { md: 480 } }}
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="solar:add-circle-bold" />}
              onClick={() => router.push(paths.dashboard.sprints)}
              sx={{ mt: 3 }}
            >
              Add from backlog
            </Button>
          }
        />
      ) : (
        <>{boardEmpty ? renderEmpty() : renderList()}</>
      )}
    </DashboardContent>
  );
}
