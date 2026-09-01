'use client';

import type { DragEndEvent } from '@dnd-kit/core';

import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect } from 'react';
import {
  useSensor,
  DndContext,
  useSensors,
  MouseSensor,
  TouchSensor,
  closestCenter,
  KeyboardSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

export type PlanningBacklogIssue = {
  id: string;
  title: string;
  storyPoints: number | null;
  columnId: string;
  version: number;
};

type PlanningColumn = { id: string; name: string };

export function BacklogOrderList({
  columns,
  issues,
  busy,
  selectedIds,
  reorderDisabled = false,
  bulkAction,
  onAdd,
  onToggleSelected,
  onReorder,
  onCreate,
}: {
  columns: PlanningColumn[];
  issues: PlanningBacklogIssue[];
  busy: boolean;
  selectedIds: string[];
  reorderDisabled?: boolean;
  bulkAction: React.ReactNode;
  onAdd: (issueId: string) => void;
  onToggleSelected: (issueId: string) => void;
  onCreate: (title: string) => Promise<void>;
  onReorder: (issue: PlanningBacklogIssue, orderedIssues: PlanningBacklogIssue[]) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const groups = columns.flatMap((column) => {
    const columnIssues = issues.filter((issue) => issue.columnId === column.id);
    return columnIssues.length ? [{ column, issues: columnIssues }] : [];
  });
  const createTask = async () => {
    const title = newTitle.trim();
    if (!title || busy) return;
    await onCreate(title);
    setNewTitle('');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ gap: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1">Backlog</Typography>
        {bulkAction}
      </Box>
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <TextField
          fullWidth
          size="small"
          value={newTitle}
          label="Quick-add backlog task"
          slotProps={{ htmlInput: { maxLength: 200 } }}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && newTitle.trim() && !busy) {
              event.preventDefault();
              void createTask();
            }
          }}
        />
        <Button
          variant="contained"
          disabled={busy || !newTitle.trim()}
          onClick={() => void createTask()}
        >
          Create
        </Button>
      </Stack>
      {reorderDisabled && issues.length > 1 && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'warning.dark' }}>
          Clear active filters to reorder backlog tasks.
        </Typography>
      )}
      {groups.length === 0 ? (
        <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
          No backlog issues
        </Typography>
      ) : (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {groups.map(({ column, issues: columnIssues }) => (
            <BacklogColumnGroup
              key={column.id}
              column={column}
              issues={columnIssues}
              busy={busy}
              selectedIds={selectedIds}
              reorderDisabled={reorderDisabled}
              onAdd={onAdd}
              onToggleSelected={onToggleSelected}
              onReorder={onReorder}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

function BacklogColumnGroup({
  column,
  issues,
  busy,
  selectedIds,
  reorderDisabled,
  onAdd,
  onToggleSelected,
  onReorder,
}: {
  column: PlanningColumn;
  issues: PlanningBacklogIssue[];
  busy: boolean;
  selectedIds: string[];
  reorderDisabled: boolean;
  onAdd: (issueId: string) => void;
  onToggleSelected: (issueId: string) => void;
  onReorder: (issue: PlanningBacklogIssue, orderedIssues: PlanningBacklogIssue[]) => Promise<void>;
}) {
  const [projectedIssues, setProjectedIssues] = useState(issues);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => setProjectedIssues(issues), [issues]);

  const persistOrder = async (movedIssue: PlanningBacklogIssue, next: PlanningBacklogIssue[]) => {
    setProjectedIssues(next);
    try {
      await onReorder(movedIssue, next);
    } catch {
      setProjectedIssues(issues);
    }
  };

  const moveBy = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= projectedIssues.length) return;
    const movedIssue = projectedIssues[index];
    void persistOrder(movedIssue, arrayMove(projectedIssues, index, nextIndex));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || reorderDisabled || busy) return;
    const oldIndex = projectedIssues.findIndex(({ id }) => id === active.id);
    const newIndex = projectedIssues.findIndex(({ id }) => id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(projectedIssues[oldIndex], arrayMove(projectedIssues, oldIndex, newIndex));
  };

  return (
    <Box component="section" aria-labelledby={`backlog-column-${column.id}`}>
      <Typography id={`backlog-column-${column.id}`} variant="caption" sx={{ fontWeight: 700 }}>
        {column.name} · {projectedIssues.length}
      </Typography>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={projectedIssues.map(({ id }) => id)}
          strategy={verticalListSortingStrategy}
        >
          <Stack
            component="ul"
            divider={<Divider flexItem />}
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            {projectedIssues.map((issue, index) => (
              <SortableBacklogRow
                key={issue.id}
                issue={issue}
                columnName={column.name}
                busy={busy}
                selected={selectedIds.includes(issue.id)}
                reorderDisabled={reorderDisabled}
                canMoveUp={index > 0}
                canMoveDown={index < projectedIssues.length - 1}
                onAdd={() => onAdd(issue.id)}
                onToggleSelected={() => onToggleSelected(issue.id)}
                onMoveUp={() => moveBy(index, -1)}
                onMoveDown={() => moveBy(index, 1)}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </Box>
  );
}

function SortableBacklogRow({
  issue,
  columnName,
  busy,
  selected,
  reorderDisabled,
  canMoveUp,
  canMoveDown,
  onAdd,
  onToggleSelected,
  onMoveUp,
  onMoveDown,
}: {
  issue: PlanningBacklogIssue;
  columnName: string;
  busy: boolean;
  selected: boolean;
  reorderDisabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onAdd: () => void;
  onToggleSelected: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id: issue.id,
    disabled: busy || reorderDisabled,
  });
  const reorderUnavailable = busy || reorderDisabled;

  return (
    <Box
      component="li"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        py: 1,
        gap: 0.5,
        display: 'flex',
        alignItems: 'center',
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      <IconButton
        size="small"
        disabled={reorderUnavailable}
        aria-label={`Drag ${issue.title} within ${columnName}`}
        sx={{ minWidth: 44, minHeight: 44 }}
        {...attributes}
        {...listeners}
      >
        <Iconify icon="custom:drag-dots-fill" />
      </IconButton>
      <Checkbox
        size="small"
        disabled={busy}
        checked={selected}
        onChange={onToggleSelected}
        inputProps={{ 'aria-label': `Select ${issue.title}` }}
        sx={{ width: 44, height: 44 }}
      />
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" noWrap>
          {issue.title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {issue.storyPoints ?? 0} points
        </Typography>
      </Box>
      <IconButton
        size="small"
        disabled={reorderUnavailable || !canMoveUp}
        aria-label={`Move ${issue.title} up in ${columnName}`}
        onClick={onMoveUp}
        sx={{ minWidth: 44, minHeight: 44 }}
      >
        <Iconify icon="eva:arrow-upward-fill" />
      </IconButton>
      <IconButton
        size="small"
        disabled={reorderUnavailable || !canMoveDown}
        aria-label={`Move ${issue.title} down in ${columnName}`}
        onClick={onMoveDown}
        sx={{ minWidth: 44, minHeight: 44 }}
      >
        <Iconify icon="eva:arrow-downward-fill" />
      </IconButton>
      <Button
        size="small"
        disabled={busy}
        aria-label={`Add ${issue.title}`}
        onClick={onAdd}
        sx={{ minHeight: 44 }}
      >
        Add
      </Button>
    </Box>
  );
}
