import type { IKanbanColumn } from 'src/types/kanban';

import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

type Props = {
  columns: IKanbanColumn[];
  value: string;
  onChange: (columnId: string) => void;
};

export function KanbanMobileColumnSelect({ columns, value, onChange }: Props) {
  if (!columns.length) return null;

  return (
    <TextField
      select
      fullWidth
      size="small"
      label="Board column"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{ htmlInput: { 'aria-label': 'Choose the visible Board column' } }}
      sx={{
        mb: 2,
        pr: { sm: 3 },
        '& .MuiOutlinedInput-root': { height: 44, minHeight: 44 },
        '& .MuiSelect-select': {
          py: 0,
          minHeight: '44px !important',
          display: 'flex',
          boxSizing: 'border-box',
          alignItems: 'center',
        },
      }}
    >
      {columns.map((column) => (
        <MenuItem key={column.id} value={String(column.id)}>
          {column.name}
        </MenuItem>
      ))}
    </TextField>
  );
}
