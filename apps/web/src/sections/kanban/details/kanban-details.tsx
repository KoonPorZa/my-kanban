import type { IKanbanTask } from 'src/types/kanban';

import { useTabs, useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import { styled } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomTabs } from 'src/components/custom-tabs';

import { TaskSaveQueue } from './task-save-queue';
import { KanbanDetailsToolbar } from './kanban-details-toolbar';
import { KanbanInputName } from '../components/kanban-input-name';
import { KanbanDetailsPriority } from './kanban-details-priority';

const STORY_POINTS_ERROR = 'Enter a whole number from 0 to 100.';

export function parseStoryPoints(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return { error: null, value: null };
  if (!/^\d+$/.test(normalizedValue)) return { error: STORY_POINTS_ERROR, value: null };
  const storyPoints = Number(normalizedValue);
  if (!Number.isSafeInteger(storyPoints) || storyPoints > 100) {
    return { error: STORY_POINTS_ERROR, value: null };
  }
  return { error: null, value: storyPoints };
}

const BlockLabel = styled('span')(({ theme }) => ({
  ...theme.typography.caption,
  width: 110,
  flexShrink: 0,
  color: theme.vars.palette.text.secondary,
  fontWeight: theme.typography.fontWeightSemiBold,
}));

type Props = {
  task: IKanbanTask;
  open: boolean;
  onClose: () => void;
  onArchiveTask: () => void;
  onDuplicateTask: () => void;
  onMovePrevious?: () => void;
  onMoveNext?: () => void;
  onMoveToBacklog?: () => void;
  onUpdateTask: (updateTask: IKanbanTask) => Promise<IKanbanTask>;
};

export function KanbanDetails({
  task,
  open,
  onUpdateTask,
  onArchiveTask,
  onDuplicateTask,
  onMovePrevious,
  onMoveNext,
  onMoveToBacklog,
  onClose,
}: Props) {
  const tabs = useTabs('overview');
  const liked = useBoolean();
  const [currentTask, setCurrentTask] = useState(task);
  const [taskName, setTaskName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? '');
  const [labels, setLabels] = useState(task.labels.join(', '));
  const [blocked, setBlocked] = useState(task.isBlocked);
  const [blockedReason, setBlockedReason] = useState(task.blockedReason ?? '');
  const [storyPoints, setStoryPoints] = useState(task.storyPoints?.toString() ?? '');
  const [storyPointsError, setStoryPointsError] = useState<string | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistSaving, setChecklistSaving] = useState(false);
  const currentTaskRef = useRef(task);
  const updateTaskRef = useRef(onUpdateTask);
  updateTaskRef.current = onUpdateTask;
  const saveQueueRef = useRef<TaskSaveQueue | null>(null);
  if (!saveQueueRef.current) {
    saveQueueRef.current = new TaskSaveQueue(
      task,
      (nextTask) => updateTaskRef.current(nextTask),
      (updated) => {
        currentTaskRef.current = updated;
        setCurrentTask(updated);
      }
    );
  }

  useEffect(() => {
    saveQueueRef.current?.sync(task);
    if (task.id !== currentTaskRef.current.id || task.version >= currentTaskRef.current.version) {
      currentTaskRef.current = task;
      setCurrentTask(task);
    }
  }, [task]);

  const saveTask = useCallback((changes: Partial<IKanbanTask>) => {
    const pendingSave = saveQueueRef.current!.enqueue(changes);
    return pendingSave.catch(() => currentTaskRef.current);
  }, []);

  const saveChecklist = useCallback(
    async (checklist: NonNullable<IKanbanTask['checklist']>) => {
      setChecklistSaving(true);
      try {
        await saveTask({
          checklist,
          checklistIncompleteCount: checklist.filter((item) => !item.isCompleted).length,
        });
      } finally {
        setChecklistSaving(false);
      }
    },
    [saveTask]
  );

  const checklist = currentTask.checklist ?? [];
  const completedCount = checklist.filter((item) => item.isCompleted).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      slotProps={{ backdrop: { invisible: true }, paper: { sx: { width: { xs: 1, sm: 520 } } } }}
    >
      <KanbanDetailsToolbar
        taskName={task.name}
        liked={liked.value}
        onArchive={onArchiveTask}
        onDuplicate={onDuplicateTask}
        onMovePrevious={onMovePrevious}
        onMoveNext={onMoveNext}
        onMoveToBacklog={onMoveToBacklog}
        onLikeToggle={liked.onToggle}
        onCloseDetails={onClose}
      />

      <CustomTabs
        value={tabs.value}
        onChange={tabs.onChange}
        variant="fullWidth"
        slotProps={{ tab: { sx: { minHeight: 44 } } }}
      >
        <Tab value="overview" label="Overview" />
        <Tab value="checklist" label={`Checklist (${completedCount}/${checklist.length})`} />
      </CustomTabs>

      <Scrollbar fillContent sx={{ py: 3, px: 2.5 }}>
        {tabs.value === 'overview' && (
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <KanbanInputName
              placeholder="Task name"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              onBlur={() => taskName.trim() && saveTask({ name: taskName.trim() })}
              onKeyUp={(event) => {
                if (event.key === 'Enter' && taskName.trim()) saveTask({ name: taskName.trim() });
              }}
              inputProps={{ id: `${task.id}-task-input` }}
            />

            <DetailRow label="Type">
              <Select
                size="small"
                value={currentTask.type}
                inputProps={{ 'aria-label': 'Task type' }}
                onChange={(event) => saveTask({ type: event.target.value as IKanbanTask['type'] })}
                sx={{ minWidth: 180 }}
              >
                {(['task', 'story', 'bug', 'chore'] as const).map((type) => (
                  <MenuItem key={type} value={type} sx={{ textTransform: 'capitalize' }}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </DetailRow>

            <DetailRow label="Priority">
              <KanbanDetailsPriority
                priority={currentTask.priority}
                onChangePriority={(priority) => saveTask({ priority })}
              />
            </DetailRow>

            <DetailRow label="Story points" align="flex-start">
              <TextField
                type="number"
                size="small"
                value={storyPoints}
                error={Boolean(storyPointsError)}
                helperText={storyPointsError ?? 'Empty counts as 0 points.'}
                onChange={(event) => {
                  setStoryPoints(event.target.value);
                  setStoryPointsError(null);
                }}
                onBlur={async () => {
                  const parsed = parseStoryPoints(storyPoints);
                  setStoryPointsError(parsed.error);
                  if (!parsed.error) await saveTask({ storyPoints: parsed.value });
                }}
                slotProps={{
                  htmlInput: { min: 0, max: 100, step: 1, 'aria-label': 'Story points' },
                }}
                sx={{ width: 190 }}
              />
            </DetailRow>

            <DetailRow label="Due date">
              <TextField
                type="date"
                size="small"
                value={currentTask.dueDate?.slice(0, 10) ?? ''}
                onChange={(event) =>
                  saveTask({
                    dueDate: event.target.value ? `${event.target.value}T12:00:00.000Z` : null,
                  })
                }
                slotProps={{ htmlInput: { 'aria-label': 'Due date' } }}
                sx={{ width: 190 }}
              />
            </DetailRow>

            <DetailRow label="Labels" align="flex-start">
              <Box sx={{ width: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={labels}
                  placeholder="frontend, urgent"
                  onChange={(event) => setLabels(event.target.value)}
                  onBlur={() =>
                    saveTask({
                      labels: [
                        ...new Set(
                          labels
                            .split(',')
                            .map((label) => label.trim())
                            .filter(Boolean)
                        ),
                      ].slice(0, 20),
                    })
                  }
                  slotProps={{ htmlInput: { 'aria-label': 'Labels separated by commas' } }}
                />
                <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                  {currentTask.labels.map((label) => (
                    <Chip key={label} color="info" label={label} size="small" variant="soft" />
                  ))}
                </Stack>
              </Box>
            </DetailRow>

            <DetailRow label="Blocked" align="flex-start">
              <Box sx={{ width: 1 }}>
                <FormControlLabel
                  label={blocked ? 'Blocked' : 'Not blocked'}
                  control={
                    <Switch
                      checked={blocked}
                      onChange={(event) => {
                        const next = event.target.checked;
                        setBlocked(next);
                        if (!next) {
                          setBlockedReason('');
                          saveTask({ isBlocked: false, blockedReason: null });
                        }
                      }}
                    />
                  }
                />
                {blocked && (
                  <TextField
                    fullWidth
                    required
                    size="small"
                    value={blockedReason}
                    label="Blocked reason"
                    onChange={(event) => setBlockedReason(event.target.value)}
                    onBlur={() =>
                      blockedReason.trim() &&
                      saveTask({ isBlocked: true, blockedReason: blockedReason.trim() })
                    }
                    helperText="A reason is required before blocked status is saved."
                  />
                )}
              </Box>
            </DetailRow>

            <DetailRow label="Description" align="flex-start">
              <TextField
                fullWidth
                multiline
                size="small"
                minRows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => saveTask({ description })}
                slotProps={{ htmlInput: { 'aria-label': 'Description' } }}
              />
            </DetailRow>
          </Box>
        )}

        {tabs.value === 'checklist' && (
          <Box sx={{ gap: 2.5, display: 'flex', flexDirection: 'column' }}>
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {completedCount} of {checklist.length} complete
              </Typography>
              <LinearProgress
                variant="determinate"
                value={checklist.length ? (completedCount / checklist.length) * 100 : 0}
              />
            </div>

            <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
              {checklist.map((item, index) => (
                <Box
                  component="li"
                  key={item.id}
                  sx={{ display: 'flex', alignItems: 'center', minHeight: 44 }}
                >
                  <Checkbox
                    checked={item.isCompleted}
                    disabled={checklistSaving}
                    inputProps={{ 'aria-label': `Mark ${item.title} complete` }}
                    sx={{ width: 44, height: 44 }}
                    onChange={() =>
                      saveChecklist(
                        checklist.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, isCompleted: !entry.isCompleted }
                            : entry
                        )
                      )
                    }
                  />
                  <TextField
                    fullWidth
                    variant="standard"
                    defaultValue={item.title}
                    disabled={checklistSaving}
                    slotProps={{
                      htmlInput: {
                        maxLength: 300,
                        'aria-label': `Checklist item ${item.title}`,
                      },
                    }}
                    sx={{
                      '& input': {
                        textDecoration: item.isCompleted ? 'line-through' : 'none',
                      },
                    }}
                    onBlur={(event) => {
                      const title = event.target.value.trim();
                      if (title && title !== item.title) {
                        saveChecklist(
                          checklist.map((entry) =>
                            entry.id === item.id ? { ...entry, title } : entry
                          )
                        );
                      }
                    }}
                  />
                  <IconButton
                    size="small"
                    disabled={index === 0 || checklistSaving}
                    aria-label={`Move ${item.title} up`}
                    onClick={() => {
                      const next = [...checklist];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      saveChecklist(next);
                    }}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Iconify icon="eva:arrow-upward-fill" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={index === checklist.length - 1 || checklistSaving}
                    aria-label={`Move ${item.title} down`}
                    onClick={() => {
                      const next = [...checklist];
                      [next[index], next[index + 1]] = [next[index + 1], next[index]];
                      saveChecklist(next);
                    }}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Iconify icon="eva:arrow-downward-fill" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={checklistSaving}
                    aria-label={`Delete ${item.title}`}
                    onClick={() => saveChecklist(checklist.filter((entry) => entry.id !== item.id))}
                    sx={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Iconify icon="solar:trash-bin-trash-bold" />
                  </IconButton>
                </Box>
              ))}
            </Stack>

            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                value={newChecklistItem}
                label="New checklist item"
                slotProps={{ htmlInput: { maxLength: 300 } }}
                onChange={(event) => setNewChecklistItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && newChecklistItem.trim()) {
                    event.preventDefault();
                    const title = newChecklistItem.trim();
                    setNewChecklistItem('');
                    saveChecklist([
                      ...checklist,
                      { id: crypto.randomUUID(), title, isCompleted: false },
                    ]);
                  }
                }}
              />
              <Button
                variant="contained"
                disabled={!newChecklistItem.trim() || checklistSaving}
                sx={{ minWidth: 44, minHeight: 44 }}
                onClick={() => {
                  const title = newChecklistItem.trim();
                  setNewChecklistItem('');
                  saveChecklist([
                    ...checklist,
                    { id: crypto.randomUUID(), title, isCompleted: false },
                  ]);
                }}
              >
                Add
              </Button>
            </Stack>
          </Box>
        )}
      </Scrollbar>
    </Drawer>
  );
}

function DetailRow({
  label,
  align = 'center',
  children,
}: {
  label: string;
  align?: 'center' | 'flex-start';
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: align }}>
      <BlockLabel sx={align === 'flex-start' ? { pt: 1.25 } : undefined}>{label}</BlockLabel>
      {children}
    </Box>
  );
}
