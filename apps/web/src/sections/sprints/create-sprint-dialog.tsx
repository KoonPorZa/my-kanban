'use client';

import type { FormEvent } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

export type CreateSprintFormValue = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
};

export type CreateSprintField = keyof CreateSprintFormValue;

export type CreateSprintDialogProps = {
  open: boolean;
  value: CreateSprintFormValue;
  loading?: boolean;
  error?: string | null;
  fieldErrors?: Partial<Record<CreateSprintField, string>>;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (field: CreateSprintField, value: string) => void;
};

export function CreateSprintDialog({
  open,
  value,
  loading = false,
  error,
  fieldErrors = {},
  onClose,
  onSubmit,
  onChange,
}: CreateSprintDialogProps) {
  const dateOrderError =
    value.startDate && value.endDate && value.endDate < value.startDate
      ? 'End date must not be before start date.'
      : null;
  const canSubmit = Boolean(
    value.name.trim() && value.startDate && value.endDate && !dateOrderError
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (canSubmit && !loading) onSubmit();
  };

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={loading ? undefined : onClose}
      disableEscapeKeyDown={loading}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Create sprint</DialogTitle>

        <DialogContent>
          <Alert severity={error ? 'error' : 'info'} sx={{ mb: 3 }} icon={false}>
            {error ??
              'Set a focused goal and a timebox. You can add work before starting the sprint.'}
          </Alert>

          <TextField
            autoFocus
            fullWidth
            required
            label="Sprint name"
            placeholder="Sprint 12"
            value={value.name}
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name}
            onChange={(event) => onChange('name', event.target.value)}
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />

          <TextField
            fullWidth
            multiline
            minRows={3}
            label="Sprint goal"
            placeholder="What outcome should be true when this sprint ends?"
            value={value.goal}
            error={Boolean(fieldErrors.goal)}
            helperText={fieldErrors.goal}
            onChange={(event) => onChange('goal', event.target.value)}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            sx={{ mt: 2.5 }}
          />

          <DialogDateFields
            value={value}
            onChange={onChange}
            fieldErrors={fieldErrors}
            dateOrderError={dateOrderError}
          />
        </DialogContent>

        <DialogActions>
          <Button color="inherit" disabled={loading} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={loading} disabled={!canSubmit}>
            Create sprint
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

function DialogDateFields({
  value,
  onChange,
  fieldErrors,
  dateOrderError,
}: Pick<CreateSprintDialogProps, 'value' | 'onChange' | 'fieldErrors'> & {
  dateOrderError: string | null;
}) {
  return (
    <Box
      component="fieldset"
      sx={{
        p: 0,
        m: 0,
        mt: 2.5,
        border: 0,
        gap: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
      }}
    >
      <TextField
        required
        type="date"
        label="Start date"
        value={value.startDate}
        error={Boolean(fieldErrors?.startDate)}
        helperText={fieldErrors?.startDate}
        onChange={(event) => onChange('startDate', event.target.value)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: value.endDate || undefined } }}
      />
      <TextField
        required
        type="date"
        label="End date"
        value={value.endDate}
        error={Boolean(fieldErrors?.endDate || dateOrderError)}
        helperText={fieldErrors?.endDate ?? dateOrderError}
        onChange={(event) => onChange('endDate', event.target.value)}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { min: value.startDate || undefined },
        }}
      />
    </Box>
  );
}
