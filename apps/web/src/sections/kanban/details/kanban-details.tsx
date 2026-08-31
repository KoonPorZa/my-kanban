import type { IKanbanTask } from 'src/types/kanban';

import { useState, useCallback } from 'react';
import { useTabs, useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import { styled } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import FormGroup from '@mui/material/FormGroup';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomTabs } from 'src/components/custom-tabs';

import { KanbanDetailsToolbar } from './kanban-details-toolbar';
import { KanbanInputName } from '../components/kanban-input-name';
import { KanbanDetailsPriority } from './kanban-details-priority';

const STARTER_CHECKLIST = ['Clarify outcome', 'Do the work', 'Verify the result'];

const BlockLabel = styled('span')(({ theme }) => ({
  ...theme.typography.caption,
  width: 100,
  flexShrink: 0,
  color: theme.vars.palette.text.secondary,
  fontWeight: theme.typography.fontWeightSemiBold,
}));

type Props = {
  task: IKanbanTask;
  open: boolean;
  onClose: () => void;
  onArchiveTask: () => void;
  onUpdateTask: (updateTask: IKanbanTask) => void;
};

export function KanbanDetails({ task, open, onUpdateTask, onArchiveTask, onClose }: Props) {
  const tabs = useTabs('overview');
  const liked = useBoolean();

  const [taskName, setTaskName] = useState(task.name);
  const [priority, setPriority] = useState(task.priority);
  const [description, setDescription] = useState(task.description ?? '');
  const [completedItems, setCompletedItems] = useState<string[]>([]);

  const saveTask = useCallback(
    (changes: Partial<IKanbanTask>) => onUpdateTask({ ...task, ...changes }),
    [onUpdateTask, task]
  );

  const handleNameKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && taskName.trim()) {
        saveTask({ name: taskName.trim() });
      }
    },
    [saveTask, taskName]
  );

  const handlePriorityChange = useCallback(
    (value: string) => {
      setPriority(value);
      saveTask({ priority: value });
    },
    [saveTask]
  );

  const toggleChecklistItem = (item: string) => {
    setCompletedItems((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      anchor="right"
      slotProps={{
        backdrop: { invisible: true },
        paper: { sx: { width: { xs: 1, sm: 480 } } },
      }}
    >
      <KanbanDetailsToolbar
        taskName={task.name}
        taskStatus={task.status}
        liked={liked.value}
        onArchive={onArchiveTask}
        onLikeToggle={liked.onToggle}
        onCloseDetails={onClose}
      />

      <CustomTabs
        value={tabs.value}
        onChange={tabs.onChange}
        variant="fullWidth"
        slotProps={{ tab: { sx: { px: 0 } } }}
      >
        <Tab value="overview" label="Overview" />
        <Tab value="checklist" label="Checklist" />
      </CustomTabs>

      <Scrollbar fillContent sx={{ py: 3, px: 2.5 }}>
        {tabs.value === 'overview' && (
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <KanbanInputName
              placeholder="Task name"
              value={taskName}
              onChange={(event) => setTaskName(event.target.value)}
              onKeyUp={handleNameKeyUp}
              inputProps={{ id: `${task.id}-task-input` }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <BlockLabel>Priority</BlockLabel>
              <KanbanDetailsPriority priority={priority} onChangePriority={handlePriorityChange} />
            </Box>

            <Box sx={{ display: 'flex' }}>
              <BlockLabel>Labels</BlockLabel>
              <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap' }}>
                {task.labels.length ? (
                  task.labels.map((label) => (
                    <Chip key={label} color="info" label={label} size="small" variant="soft" />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No labels
                  </Typography>
                )}
              </Box>
            </Box>

            <Box sx={{ display: 'flex' }}>
              <BlockLabel>Description</BlockLabel>
              <TextField
                fullWidth
                multiline
                size="small"
                minRows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => saveTask({ description })}
                slotProps={{ input: { sx: { typography: 'body2' } } }}
              />
            </Box>
          </Box>
        )}

        {tabs.value === 'checklist' && (
          <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
            <div>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {completedItems.length} of {STARTER_CHECKLIST.length}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(completedItems.length / STARTER_CHECKLIST.length) * 100}
              />
            </div>

            <FormGroup>
              {STARTER_CHECKLIST.map((item) => (
                <FormControlLabel
                  key={item}
                  label={item}
                  control={
                    <Checkbox
                      disableRipple
                      checked={completedItems.includes(item)}
                      onChange={() => toggleChecklistItem(item)}
                    />
                  }
                />
              ))}
            </FormGroup>

            <Button
              variant="outlined"
              startIcon={<Iconify icon="mingcute:add-line" />}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add item
            </Button>
          </Box>
        )}
      </Scrollbar>
    </Drawer>
  );
}
