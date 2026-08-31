'use client';

import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
  CollisionDetection,
} from '@dnd-kit/core';

import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect, useCallback } from 'react';
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
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';

import { DashboardContent } from 'src/layouts/dashboard';
import { moveColumn, useGetBoard, previewTaskMove, persistTaskMove } from 'src/actions/kanban';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { kanbanClasses } from '../classes';
import { coordinateGetter } from '../utils';
import { KanbanColumn } from '../column/kanban-column';
import { KanbanTaskItem } from '../item/kanban-task-item';
import { KanbanColumnAdd } from '../column/kanban-column-add';
import { KanbanColumnSkeleton } from '../components/kanban-skeleton';
import { KanbanDragOverlay } from '../components/kanban-drag-overlay';

// ----------------------------------------------------------------------

const PLACEHOLDER_ID = 'placeholder';

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
  const { board, boardLoading, boardEmpty, boardError, projectMode, activeSprint } = useGetBoard();

  const recentlyMovedToNewContainer = useRef(false);
  const lastOverId = useRef<UniqueIdentifier>(null);

  const [columnFixed, setColumnFixed] = useState(true);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const columnIds = board.columns.map((column) => column.id);
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
      if (activeId && activeId in board.tasks) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (column) => column.id in board.tasks
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
        if (overId in board.tasks) {
          const columnItems = board.tasks[overId].map((task) => task.id);

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
    [activeId, board?.tasks]
  );

  const findColumn = (id: UniqueIdentifier) => {
    if (id in board.tasks) {
      return id;
    }

    return Object.keys(board.tasks).find((key) =>
      board.tasks[key].map((task) => task.id).includes(id)
    );
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
    setActiveId(active.id);
  };

  /**
   * onDragOver
   */
  const onDragOver = ({ active, over }: DragOverEvent) => {
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
      return;
    }

    const activeColumn = findColumn(active.id);

    if (!activeColumn) {
      setActiveId(null);
      return;
    }

    const overId = over?.id;

    if (overId == null) {
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
          await persistTaskMove(board.projectId, activeTask, overColumn, updateTasks[overColumn]);
        } catch (error) {
          console.error(error);
          toast.error('Could not move task. The Board was refreshed.');
        }
      }
    }

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
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
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
              {board?.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  projectId={board.projectId}
                  scrumMode={projectMode === 'scrum'}
                  column={column}
                  tasks={board.tasks[column.id]}
                >
                  <SortableContext
                    items={board.tasks[column.id]}
                    strategy={verticalListSortingStrategy}
                  >
                    {board.tasks[column.id].map((task) => (
                      <KanbanTaskItem
                        key={task.id}
                        projectId={board.projectId}
                        task={task}
                        disabled={isSortingContainer}
                      />
                    ))}
                  </SortableContext>
                </KanbanColumn>
              ))}

              <KanbanColumnAdd id={PLACEHOLDER_ID} projectId={board.projectId} />
            </SortableContext>
          </Box>
        </Stack>
      </Stack>

      <KanbanDragOverlay
        columns={board?.columns}
        tasks={board?.tasks}
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
