'use client';

import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

export type IncompleteWorkDestination = { type: 'backlog' } | { type: 'sprint'; sprintId: string };

export type SprintDestinationOption = {
  id: string;
  name: string;
};

export type CompleteSprintDialogProps = {
  open: boolean;
  sprintName: string;
  completedPoints: number;
  completedIssueCount: number;
  incompletePoints: number;
  incompleteIssueCount: number;
  destination: IncompleteWorkDestination;
  plannedSprints: SprintDestinationOption[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onComplete: () => void;
  onDestinationChange: (destination: IncompleteWorkDestination) => void;
};

export function CompleteSprintDialog({
  open,
  sprintName,
  completedPoints,
  completedIssueCount,
  incompletePoints,
  incompleteIssueCount,
  destination,
  plannedSprints,
  loading = false,
  error,
  onClose,
  onComplete,
  onDestinationChange,
}: CompleteSprintDialogProps) {
  const destinationType = destination.type;
  const hasIncompleteWork = incompleteIssueCount > 0;
  const canComplete =
    !hasIncompleteWork || destination.type === 'backlog' || Boolean(destination.sprintId);

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={loading ? undefined : onClose}
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>Complete {sprintName}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2.5 }}>
            {error}
          </Alert>
        )}

        <Alert severity="success" icon={false} sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            {completedIssueCount} issues · {completedPoints} story points completed
          </Typography>
          <Typography variant="caption">
            This becomes the recorded velocity for {sprintName}.
          </Typography>
        </Alert>

        {hasIncompleteWork ? (
          <>
            <Typography variant="subtitle1">Move incomplete work</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              {incompleteIssueCount} incomplete issue{incompleteIssueCount === 1 ? '' : 's'} (
              {incompletePoints} points) need a destination.
            </Typography>

            <FormControl sx={{ mt: 2, width: 1 }}>
              <RadioGroup
                value={destinationType}
                aria-label="Incomplete work destination"
                onChange={(event) => {
                  if (event.target.value === 'backlog') {
                    onDestinationChange({ type: 'backlog' });
                  } else {
                    onDestinationChange({ type: 'sprint', sprintId: plannedSprints[0]?.id ?? '' });
                  }
                }}
              >
                <FormControlLabel value="backlog" control={<Radio />} label="Move to backlog" />
                <FormControlLabel
                  value="sprint"
                  disabled={plannedSprints.length === 0}
                  control={<Radio />}
                  label="Move to a planned sprint"
                />
              </RadioGroup>
            </FormControl>

            {destination.type === 'sprint' && (
              <TextField
                select
                fullWidth
                required
                label="Destination sprint"
                value={destination.sprintId}
                onChange={(event) =>
                  onDestinationChange({ type: 'sprint', sprintId: event.target.value })
                }
                sx={{ mt: 1.5 }}
              >
                {plannedSprints.map((sprint) => (
                  <MenuItem key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Every issue is complete. No work needs to be moved.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" disabled={loading} onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="success"
          variant="contained"
          loading={loading}
          disabled={!canComplete}
          onClick={onComplete}
        >
          Complete sprint
        </Button>
      </DialogActions>
    </Dialog>
  );
}
