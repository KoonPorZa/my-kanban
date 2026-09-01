import type { Theme, SxProps } from '@mui/material/styles';
import type { AnimateLayoutChanges } from '@dnd-kit/sortable';
import type { IKanbanTask, IKanbanColumn } from 'src/types/kanban';

import { useCallback } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useBoolean } from 'minimal-shared/hooks';
import { useGetBoard as useGetBoardApi } from '@my-kanban/api-client';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';

import { createTask, clearColumn, updateColumn, archiveColumn } from 'src/actions/kanban';

import { toast } from 'src/components/snackbar';

import ColumnBase from './column-base';
import { KanbanTaskAdd } from '../components/kanban-task-add';
import { KanbanColumnToolBar } from './kanban-column-toolbar';

// ----------------------------------------------------------------------

type ColumnProps = {
  projectId: string;
  scrumMode?: boolean;
  disabled?: boolean;
  sx?: SxProps<Theme>;
  tasks: IKanbanTask[];
  column: IKanbanColumn;
  children: React.ReactNode;
};

const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

export function KanbanColumn({ projectId, children, column, tasks, disabled, sx }: ColumnProps) {
  const openAddTask = useBoolean();
  const fullBoardQuery = useGetBoardApi(projectId, undefined, {
    query: { staleTime: 15_000, refetchOnWindowFocus: false },
  });

  const { attributes, isDragging, listeners, setNodeRef, transition, active, over, transform } =
    useSortable({
      id: column.id,
      data: { type: 'container', children: tasks },
      animateLayoutChanges,
    });

  const tasksIds = tasks.map((task) => task.id);

  const isOverContainer = over
    ? (column.id === over.id && active?.data.current?.type !== 'container') ||
      tasksIds.includes(over.id)
    : false;

  const handleUpdateColumn = useCallback(
    async (columnName: string) => {
      try {
        if (column.name !== columnName) {
          await updateColumn(projectId, column, columnName);

          toast.success('Update success!', { position: 'top-center' });
        }
      } catch (error) {
        console.error(error);
        toast.error('Could not update column. Try again.', { position: 'top-center' });
      }
    },
    [column, projectId]
  );

  const handleClearColumn = useCallback(async () => {
    try {
      await clearColumn(projectId, column);
    } catch (error) {
      console.error(error);
      toast.error('Could not clear column. Try again.', { position: 'top-center' });
    }
  }, [column, projectId]);

  const handleArchiveColumn = useCallback(
    async (destinationColumnId?: string, allowIncompleteChecklist = false) => {
      try {
        await archiveColumn(projectId, column, destinationColumnId, allowIncompleteChecklist);

        toast.success('Column archived', { position: 'top-center' });
      } catch (error) {
        console.error(error);
        toast.error('Could not archive column. Try again.', { position: 'top-center' });
      }
    },
    [column, projectId]
  );

  const handleUpdateWip = useCallback(
    async (wipLimit: number | null) => {
      try {
        await updateColumn(projectId, column, { wipLimit });
        toast.success('WIP limit updated', { position: 'top-center' });
      } catch (error) {
        console.error(error);
        toast.error('Could not update WIP limit. Try again.', { position: 'top-center' });
      }
    },
    [column, projectId]
  );

  const archiveOptions =
    fullBoardQuery.data?.columns
      .filter((item) => item.id !== column.id)
      .map((item) => ({ id: item.id, name: item.name, category: item.category })) ?? [];
  const affectedTasks =
    fullBoardQuery.data?.issues.filter((issue) => issue.columnId === String(column.id)) ?? tasks;
  const incompleteChecklistCount = affectedTasks.reduce(
    (total, task) =>
      total +
      (task.checklistIncompleteCount ??
        (task.checklist ?? []).filter((item) => !item.isCompleted).length),
    0
  );
  const totalPoints = tasks.reduce((total, task) => total + (task.storyPoints ?? 0), 0);

  const handleAddTask = useCallback(
    async (taskData: IKanbanTask) => {
      try {
        await createTask(projectId, column.id, taskData);

        openAddTask.onFalse();
      } catch (error) {
        console.error(error);
        toast.error('Could not create task. Try again.', { position: 'top-center' });
      }
    },
    [column.id, openAddTask, projectId]
  );

  return (
    <ColumnBase
      ref={disabled ? undefined : setNodeRef}
      style={{
        transition,
        transform: CSS.Translate.toString(transform),
      }}
      sx={sx}
      stateProps={{
        dragging: isDragging,
        overContainer: isOverContainer,
        handleProps: { ...attributes, ...listeners },
      }}
      slots={{
        header: (
          <KanbanColumnToolBar
            handleProps={{ ...attributes, ...listeners }}
            totalTasks={tasks.length}
            totalPoints={totalPoints}
            columnName={column.name}
            category={column.category}
            wipLimit={column.wipLimit}
            archiveOptions={archiveOptions}
            incompleteChecklistCount={incompleteChecklistCount}
            onUpdateColumn={handleUpdateColumn}
            onUpdateWip={handleUpdateWip}
            onClearColumn={handleClearColumn}
            onArchiveColumn={handleArchiveColumn}
            onToggleAddTask={openAddTask.onToggle}
          />
        ),
        main: children,
        action: (
          <KanbanTaskAdd
            status={column.name}
            openAddTask={openAddTask.value}
            onAddTask={handleAddTask}
            onCloseAddTask={openAddTask.onFalse}
          />
        ),
      }}
    />
  );
}
