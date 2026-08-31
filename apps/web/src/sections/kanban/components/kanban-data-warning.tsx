import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

type Props = {
  skippedIssueCount: number;
};

export function KanbanDataWarning({ skippedIssueCount }: Props) {
  if (skippedIssueCount <= 0) return null;

  const taskLabel = skippedIssueCount === 1 ? 'task' : 'tasks';

  return (
    <Alert
      severity="warning"
      variant="outlined"
      aria-live="polite"
      sx={{ mr: { sm: 3 }, mb: 2, alignItems: 'flex-start' }}
    >
      <AlertTitle>Some Board data could not be displayed</AlertTitle>
      {skippedIssueCount} invalid {taskLabel} {skippedIssueCount === 1 ? 'was' : 'were'} skipped.
      The rest of the Board is still available.
    </Alert>
  );
}
