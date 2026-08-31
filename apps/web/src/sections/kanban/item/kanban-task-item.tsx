import type { IKanbanTask } from 'src/types/kanban';
import type { Theme, SxProps } from '@mui/material/styles';

import { useSortable } from '@dnd-kit/sortable';
import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import { updateTask, archiveTask, moveTaskToBacklog } from 'src/actions/kanban';

import { toast } from 'src/components/snackbar';

import ItemBase from './item-base';
import { KanbanDetails } from '../details/kanban-details';

// ----------------------------------------------------------------------

type TaskItemProps = {
  projectId: string;
  disabled?: boolean;
  sx?: SxProps<Theme>;
  task: IKanbanTask;
};

export function KanbanTaskItem({ projectId, task, disabled, sx }: TaskItemProps) {
  const taskDetailsDialog = useBoolean();

  const { setNodeRef, listeners, isDragging, isSorting, transform, transition } = useSortable({
    id: task?.id,
  });

  const mounted = useMountStatus();
  const mountedWhileDragging = isDragging && !mounted;

  const handleArchiveTask = useCallback(async () => {
    try {
      await archiveTask(projectId, task);
      toast.success('Task archived', { position: 'top-center' });
    } catch (error) {
      console.error(error);
      toast.error('Could not archive task. Try again.', { position: 'top-center' });
    }
  }, [projectId, task]);

  const handleUpdateTask = useCallback(
    async (taskData: IKanbanTask) => {
      try {
        await updateTask(projectId, taskData);
      } catch (error) {
        console.error(error);
        toast.error('Could not update task. Your changes were not saved.', {
          position: 'top-center',
        });
      }
    },
    [projectId]
  );

  const handleMoveToBacklog = useCallback(async () => {
    try {
      await moveTaskToBacklog(projectId, task);
      taskDetailsDialog.onFalse();
      toast.success('Task moved to backlog', { position: 'top-center' });
    } catch (error) {
      console.error(error);
      toast.error('Could not move task to backlog. Try again.', { position: 'top-center' });
    }
  }, [projectId, task, taskDetailsDialog]);

  const renderTaskDetailsDialog = () => (
    <KanbanDetails
      task={task}
      open={taskDetailsDialog.value}
      onClose={taskDetailsDialog.onFalse}
      onUpdateTask={handleUpdateTask}
      onArchiveTask={handleArchiveTask}
      onMoveToBacklog={task.sprintId ? handleMoveToBacklog : undefined}
    />
  );

  return (
    <>
      <ItemBase
        ref={disabled ? undefined : setNodeRef}
        task={task}
        open={taskDetailsDialog.value}
        onClick={taskDetailsDialog.onTrue}
        stateProps={{
          transform,
          listeners,
          transition,
          sorting: isSorting,
          dragging: isDragging,
          fadeIn: mountedWhileDragging,
        }}
        sx={sx}
      />

      {renderTaskDetailsDialog()}
    </>
  );
}

// ----------------------------------------------------------------------

function useMountStatus() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsMounted(true), 500);

    return () => clearTimeout(timeout);
  }, []);

  return isMounted;
}
