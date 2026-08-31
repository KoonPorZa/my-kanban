import type { BoxProps } from '@mui/material/Box';

import { useState, useCallback } from 'react';
import { uuidv4 } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { inputBaseClasses } from '@mui/material/InputBase';
import ClickAwayListener from '@mui/material/ClickAwayListener';

import { createColumn } from 'src/actions/kanban';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  projectId: string;
};

export function KanbanColumnAdd({ projectId, sx, ...other }: Props) {
  const [columnName, setColumnName] = useState('');

  const openAddColumn = useBoolean();

  const handleChangeName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setColumnName(event.target.value);
  }, []);

  const handleCreateColumn = useCallback(async () => {
    try {
      const columnData = {
        id: uuidv4(),
        projectId,
        version: 1,
        category: 'todo' as const,
        wipLimit: null,
        name: columnName.trim() ? columnName : 'Untitled',
      };

      await createColumn(projectId, columnData);

      setColumnName('');

      openAddColumn.onFalse();
    } catch (error) {
      console.error(error);
    }
  }, [columnName, openAddColumn, projectId]);

  const handleKeyUpCreateColumn = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleCreateColumn();
      }
    },
    [handleCreateColumn]
  );

  const handleCancel = useCallback(() => {
    setColumnName('');
    openAddColumn.onFalse();
  }, [openAddColumn]);

  return (
    <>
      <Box
        sx={[
          () => ({
            flex: '0 0 auto',
            width: 'var(--column-width)',
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {openAddColumn.value ? (
          <ClickAwayListener onClickAway={handleCancel}>
            <TextField
              autoFocus
              fullWidth
              placeholder="Untitled"
              value={columnName}
              onChange={handleChangeName}
              onKeyUp={handleKeyUpCreateColumn}
              helperText="Press Enter to create the column."
              sx={{ [`& .${inputBaseClasses.input}`]: { typography: 'h6' } }}
            />
          </ClickAwayListener>
        ) : (
          <Button
            fullWidth
            size="large"
            color="inherit"
            variant="outlined"
            startIcon={<Iconify icon="mingcute:add-line" sx={{ mr: -0.5 }} />}
            onClick={openAddColumn.onTrue}
          >
            Add column
          </Button>
        )}
      </Box>

      <Box sx={{ width: '1px', flexShrink: 0 }} />
    </>
  );
}
