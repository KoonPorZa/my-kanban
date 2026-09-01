import type { SelectChangeEvent } from '@mui/material/Select';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';

import { Iconify } from 'src/components/iconify';

import type {
  DueFilter,
  SprintFilter,
  BlockedFilter,
  BoardFilterState,
  DoneRetentionDays,
} from './board-filter';

type Props = {
  value: BoardFilterState;
  labels: string[];
  sprints: { id: string; name: string }[];
  activeCount: number;
  resultCount: number;
  onChange: (value: BoardFilterState) => void;
  onClear: () => void;
};

const TYPE_OPTIONS = ['task', 'story', 'bug', 'chore'];
const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low', 'none'];

function MultipleFilter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <FormControl
      size="small"
      sx={{
        minWidth: 132,
        '& [role="combobox"]': {
          boxSizing: 'border-box',
          minHeight: { xs: '44px !important', md: 'unset' },
        },
      }}
    >
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        multiple
        value={value}
        sx={{
          minHeight: { xs: 44, md: 40 },
          '& .MuiSelect-select': {
            boxSizing: 'border-box',
            minHeight: { xs: 44, md: 'auto' },
          },
        }}
        input={<OutlinedInput label={label} />}
        labelId={`${id}-label`}
        onChange={(event: SelectChangeEvent<string[]>) => {
          const next = event.target.value;
          onChange(typeof next === 'string' ? next.split(',') : next);
        }}
        renderValue={(selected) => `${label} · ${selected.length}`}
        slotProps={{ input: { 'aria-label': `Filter by ${label.toLowerCase()}` } }}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox size="small" checked={value.includes(option)} />
            <ListItemText primary={option} sx={{ textTransform: 'capitalize' }} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function KanbanFilterToolbar({
  value,
  labels,
  sprints,
  activeCount,
  resultCount,
  onChange,
  onClear,
}: Props) {
  const update = <Key extends keyof BoardFilterState>(key: Key, next: BoardFilterState[Key]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <Box
      component="section"
      aria-label="Board filters"
      sx={{
        mb: 2,
        mr: { sm: 3 },
        p: 1.5,
        border: (theme) => `1px solid ${theme.vars.palette.divider}`,
        borderRadius: 2,
        bgcolor: 'background.paper',
        '& .MuiInputLabel-root': { color: 'text.primary' },
        '& .MuiInputLabel-root.Mui-focused': { color: 'text.primary' },
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
        <TextField
          fullWidth
          size="small"
          value={value.query}
          placeholder="Search title or description"
          onChange={(event) => update('query', event.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': 'Search tasks by title or description' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="eva:search-fill" width={18} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: { md: 280 } }}
        />

        <Button
          color={value.focus ? 'primary' : 'inherit'}
          variant={value.focus ? 'contained' : 'outlined'}
          startIcon={<Iconify icon="solar:flag-bold" />}
          aria-pressed={value.focus}
          onClick={() => update('focus', !value.focus)}
          sx={{ flexShrink: 0, minHeight: { xs: 44, md: 0 } }}
        >
          Focus
        </Button>

        <Chip
          variant="soft"
          color={resultCount ? 'default' : 'warning'}
          label={`${resultCount} visible`}
          aria-live="polite"
        />

        {activeCount > 0 && (
          <Button
            size="small"
            color="inherit"
            onClick={onClear}
            startIcon={<Iconify icon="solar:restart-bold" />}
            sx={{ flexShrink: 0 }}
          >
            Clear {activeCount}
          </Button>
        )}
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1.25, pb: 0.25, overflowX: 'auto', alignItems: 'center' }}
      >
        <MultipleFilter
          id="task-type"
          label="Type"
          value={value.types}
          options={TYPE_OPTIONS}
          onChange={(next) => update('types', next)}
        />
        <MultipleFilter
          id="task-priority"
          label="Priority"
          value={value.priorities}
          options={PRIORITY_OPTIONS}
          onChange={(next) => update('priorities', next)}
        />
        <MultipleFilter
          id="task-label"
          label="Label"
          value={value.labels}
          options={labels}
          onChange={(next) => update('labels', next)}
        />

        <TextField
          select
          size="small"
          label="Due"
          value={value.due}
          onChange={(event) => update('due', event.target.value as DueFilter)}
          slotProps={{ htmlInput: { 'aria-label': 'Filter by due date' } }}
          sx={{
            minWidth: 132,
            '& .MuiInputBase-root': { minHeight: { xs: 44, md: 40 } },
            '& .MuiSelect-select': {
              boxSizing: 'border-box',
              minHeight: { xs: 44, md: 'auto' },
            },
          }}
        >
          <MenuItem value="all">Any date</MenuItem>
          <MenuItem value="overdue">Overdue</MenuItem>
          <MenuItem value="today">Due today</MenuItem>
          <MenuItem value="week">Next 7 days</MenuItem>
          <MenuItem value="none">No due date</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Blocked"
          value={value.blocked}
          onChange={(event) => update('blocked', event.target.value as BlockedFilter)}
          slotProps={{ htmlInput: { 'aria-label': 'Filter by blocked state' } }}
          sx={{
            minWidth: 132,
            '& .MuiInputBase-root': { minHeight: { xs: 44, md: 40 } },
            '& .MuiSelect-select': {
              boxSizing: 'border-box',
              minHeight: { xs: 44, md: 'auto' },
            },
          }}
        >
          <MenuItem value="all">Any state</MenuItem>
          <MenuItem value="blocked">Blocked</MenuItem>
          <MenuItem value="unblocked">Not blocked</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Sprint"
          value={value.sprint}
          onChange={(event) => update('sprint', event.target.value as SprintFilter)}
          slotProps={{ htmlInput: { 'aria-label': 'Filter by Sprint assignment' } }}
          sx={{
            minWidth: 132,
            '& .MuiInputBase-root': { minHeight: { xs: 44, md: 40 } },
            '& .MuiSelect-select': {
              boxSizing: 'border-box',
              minHeight: { xs: 44, md: 'auto' },
            },
          }}
        >
          <MenuItem value="all">Any Sprint</MenuItem>
          <MenuItem value="backlog">Backlog</MenuItem>
          <MenuItem value="assigned">Assigned</MenuItem>
          {sprints.map((sprint) => (
            <MenuItem key={sprint.id} value={`sprint:${sprint.id}`}>
              {sprint.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Keep Done"
          value={value.retentionDays}
          onChange={(event) =>
            update('retentionDays', Number(event.target.value) as DoneRetentionDays)
          }
          slotProps={{ htmlInput: { 'aria-label': 'Done task retention period' } }}
          sx={{
            minWidth: 132,
            '& .MuiInputBase-root': { minHeight: { xs: 44, md: 40 } },
            '& .MuiSelect-select': {
              boxSizing: 'border-box',
              minHeight: { xs: 44, md: 'auto' },
            },
          }}
        >
          {[7, 14, 30].map((days) => (
            <MenuItem key={days} value={days}>
              {days} days
            </MenuItem>
          ))}
        </TextField>

        <FormControlLabel
          label="Show older Done"
          sx={{ ml: 0.5, whiteSpace: 'nowrap' }}
          control={
            <Switch
              size="small"
              checked={value.showOlderDone}
              onChange={(event) => update('showOlderDone', event.target.checked)}
              slotProps={{ input: { 'aria-label': 'Show older completed tasks' } }}
            />
          }
        />
      </Stack>
    </Box>
  );
}
