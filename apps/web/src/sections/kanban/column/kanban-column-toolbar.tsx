import type { BoxProps } from '@mui/material/Box';

import { varAlpha } from 'minimal-shared/utils';
import { useBoolean, usePopover } from 'minimal-shared/hooks';
import { useId, useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { KanbanInputName } from '../components/kanban-input-name';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  handleProps?: any;
  totalTasks?: number;
  totalPoints?: number;
  columnName: string;
  category?: 'todo' | 'in_progress' | 'done';
  wipLimit?: number | null;
  archiveOptions?: Array<{
    id: string;
    name: string;
    category: 'todo' | 'in_progress' | 'done';
  }>;
  incompleteChecklistCount?: number;
  onClearColumn?: () => void;
  onArchiveColumn?: (destinationColumnId?: string, allowIncompleteChecklist?: boolean) => void;
  onToggleAddTask?: () => void;
  onUpdateColumn?: (inputName: string) => void;
  onUpdateWip?: (wipLimit: number | null) => void;
};

export function KanbanColumnToolBar({
  sx,
  columnName,
  totalTasks,
  totalPoints = 0,
  category,
  wipLimit,
  archiveOptions = [],
  incompleteChecklistCount = 0,
  handleProps,
  onClearColumn,
  onToggleAddTask,
  onArchiveColumn,
  onUpdateColumn,
  onUpdateWip,
}: Props) {
  const inputId = useId();

  const renameRef = useRef<HTMLInputElement>(null);

  const menuActions = usePopover();
  const confirmDialog = useBoolean();

  const [name, setName] = useState(columnName);
  const [wipValue, setWipValue] = useState(wipLimit ? String(wipLimit) : '');
  const [destinationColumnId, setDestinationColumnId] = useState('');
  const destinationColumn = archiveOptions.find(({ id }) => id === destinationColumnId);

  useEffect(() => setWipValue(wipLimit ? String(wipLimit) : ''), [wipLimit]);
  useEffect(() => {
    if (!archiveOptions.some(({ id }) => id === destinationColumnId)) {
      setDestinationColumnId(archiveOptions[0]?.id ?? '');
    }
  }, [archiveOptions, destinationColumnId]);

  useEffect(() => {
    if (menuActions.open) {
      if (renameRef.current) {
        renameRef.current.focus();
      }
    }
  }, [menuActions.open]);

  const handleChangeName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleKeyUpUpdateColumn = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        if (renameRef.current) {
          renameRef.current.blur();
        }
        onUpdateColumn?.(name);
      }
    },
    [name, onUpdateColumn]
  );

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
    >
      <MenuList>
        <MenuItem onClick={menuActions.onClose}>
          <Iconify icon="solar:pen-bold" />
          Rename
        </MenuItem>

        <MenuItem
          onClick={() => {
            onClearColumn?.();
            menuActions.onClose();
          }}
        >
          <Iconify icon="solar:eraser-bold" />
          Clear
        </MenuItem>

        <MenuItem
          disabled={category === 'done'}
          onClick={(event) => event.stopPropagation()}
          sx={{ gap: 1, py: 1.5 }}
        >
          <TextField
            size="small"
            type="number"
            label="WIP limit"
            value={wipValue}
            slotProps={{ htmlInput: { min: 1 } }}
            onChange={(event) => setWipValue(event.target.value)}
            sx={{ width: 120 }}
          />
          <Button
            size="small"
            disabled={Boolean(wipValue) && Number(wipValue) < 1}
            onClick={() => {
              onUpdateWip?.(wipValue ? Number(wipValue) : null);
              menuActions.onClose();
            }}
          >
            Save
          </Button>
        </MenuItem>

        <MenuItem
          onClick={() => {
            confirmDialog.onTrue();
            menuActions.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:archive-down-minimlistic-bold" />
          Archive
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Archive column"
      content={
        <Box sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Tasks are preserved and moved to the selected destination.
          </Typography>
          <TextField
            select
            fullWidth
            label="Task destination"
            value={destinationColumnId}
            helperText="A destination is required when this column contains tasks."
            onChange={(event) => setDestinationColumnId(event.target.value)}
          >
            {archiveOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>
          {destinationColumn?.category === 'done' && incompleteChecklistCount > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Moving these tasks to Done affects {incompleteChecklistCount} incomplete checklist
              item(s) and requires confirmation.
            </Alert>
          )}
        </Box>
      }
      action={
        <Button
          variant="contained"
          color="error"
          disabled={Boolean(totalTasks) && !destinationColumnId}
          onClick={() => {
            const submitted = submitColumnArchive({
              archiveOptions,
              destinationColumnId,
              incompleteChecklistCount,
              onArchiveColumn,
            });
            if (submitted) confirmDialog.onFalse();
          }}
        >
          Archive
        </Button>
      }
    />
  );

  return (
    <>
      <Box
        sx={[
          { display: 'flex', flexWrap: 'wrap', alignItems: 'center' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <Label
          sx={[
            (theme) => ({
              borderRadius: '50%',
              borderColor: varAlpha(theme.vars.palette.grey['500Channel'], 0.24),
            }),
          ]}
        >
          {totalTasks}
        </Label>

        <KanbanInputName
          inputRef={renameRef}
          placeholder="Column name"
          value={name}
          onChange={handleChangeName}
          onKeyUp={handleKeyUpUpdateColumn}
          inputProps={{ id: `${columnName}-${inputId}-column-input` }}
          sx={{ mx: 1 }}
        />

        <Typography
          variant="caption"
          sx={{
            mr: 1,
            color: wipLimit && (totalTasks ?? 0) > wipLimit ? 'error.main' : 'text.secondary',
          }}
        >
          {totalPoints} pts
          {wipLimit ? ` · ${totalTasks ?? 0}/${wipLimit} WIP` : ''}
          {wipLimit && (totalTasks ?? 0) > wipLimit ? ' · Over limit' : ''}
        </Typography>

        <IconButton
          size="small"
          color="inherit"
          aria-label={`Add task to ${columnName}`}
          onClick={onToggleAddTask}
          sx={{ minWidth: { xs: 44, sm: 30 }, minHeight: { xs: 44, sm: 30 } }}
        >
          <Iconify icon="solar:add-circle-bold" />
        </IconButton>

        <IconButton
          size="small"
          aria-label={`Open ${columnName} column settings`}
          color={menuActions.open ? 'inherit' : 'default'}
          onClick={menuActions.onOpen}
          sx={{ minWidth: { xs: 44, sm: 30 }, minHeight: { xs: 44, sm: 30 } }}
        >
          <Iconify icon="solar:menu-dots-bold-duotone" />
        </IconButton>

        <IconButton
          size="small"
          aria-label={`Reorder ${columnName} column`}
          sx={{ minWidth: { xs: 44, sm: 30 }, minHeight: { xs: 44, sm: 30 } }}
          {...handleProps}
        >
          <Iconify icon="custom:drag-dots-fill" />
        </IconButton>
      </Box>

      {renderMenuActions()}
      {renderConfirmDialog()}
    </>
  );
}

export function submitColumnArchive({
  archiveOptions,
  destinationColumnId,
  incompleteChecklistCount,
  onArchiveColumn,
  confirm = (message) => window.confirm(message),
}: {
  archiveOptions: Array<{
    id: string;
    name: string;
    category: 'todo' | 'in_progress' | 'done';
  }>;
  destinationColumnId: string;
  incompleteChecklistCount: number;
  onArchiveColumn?: (destinationColumnId?: string, allowIncompleteChecklist?: boolean) => void;
  confirm?: (message: string) => boolean;
}) {
  const destination = archiveOptions.find(({ id }) => id === destinationColumnId);
  const requiresOverride = destination?.category === 'done' && incompleteChecklistCount > 0;
  if (
    requiresOverride &&
    !confirm(
      `Tasks in this column have ${incompleteChecklistCount} incomplete checklist item(s). Move them to Done anyway?`
    )
  ) {
    return false;
  }

  onArchiveColumn?.(destinationColumnId || undefined, requiresOverride);
  return true;
}
