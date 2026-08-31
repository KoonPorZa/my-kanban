'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { fDate } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

export type SprintHistoryItem = {
  id: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  completedAt: string;
  issueCount: number;
  completedIssueCount: number;
  plannedPoints: number;
  completedPoints: number;
  incompleteIssueCount?: number;
  incompletePoints?: number;
};

export type SprintHistoryListProps = {
  sprints: SprintHistoryItem[];
  averageVelocity?: number;
  onOpenSprint?: (sprintId: string) => void;
  emptyMessage?: string;
};

export function SprintHistoryList({
  sprints,
  averageVelocity,
  onOpenSprint,
  emptyMessage = 'Complete a sprint to begin building a velocity history.',
}: SprintHistoryListProps) {
  const computedAverage =
    sprints.length > 0
      ? sprints.reduce((total, sprint) => total + sprint.completedPoints, 0) / sprints.length
      : 0;
  const displayedAverage = averageVelocity ?? computedAverage;
  const scaleMax = Math.max(1, ...sprints.map((sprint) => sprint.plannedPoints));

  return (
    <Card variant="outlined">
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6">Sprint history</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Delivery trend across completed sprints
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="h4">{displayedAverage.toFixed(1)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Average velocity
          </Typography>
        </Box>
      </Box>

      <Divider />

      {sprints.length === 0 ? (
        <Box sx={{ py: 7, px: 3, textAlign: 'center' }}>
          <Iconify icon="solar:chart-square-outline" width={42} sx={{ color: 'text.disabled' }} />
          <Typography variant="subtitle1" sx={{ mt: 1.5 }}>
            No sprint history yet
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {emptyMessage}
          </Typography>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {sprints.map((sprint) => (
            <HistoryRow
              key={sprint.id}
              sprint={sprint}
              scaleMax={scaleMax}
              onOpen={onOpenSprint ? () => onOpenSprint(sprint.id) : undefined}
            />
          ))}
        </Stack>
      )}
    </Card>
  );
}

function HistoryRow({
  sprint,
  scaleMax,
  onOpen,
}: {
  sprint: SprintHistoryItem;
  scaleMax: number;
  onOpen?: () => void;
}) {
  const completionRate =
    sprint.plannedPoints > 0
      ? Math.min(100, (sprint.completedPoints / sprint.plannedPoints) * 100)
      : 0;

  return (
    <Box
      sx={(theme) => ({
        p: 3,
        gap: 3,
        display: 'grid',
        alignItems: 'center',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(200px, 0.8fr) minmax(240px, 1.2fr) auto' },
        transition: theme.transitions.create('background-color'),
        '&:hover': { bgcolor: varAlpha(theme.vars.palette.grey['500Channel'], 0.04) },
      })}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          component={onOpen ? 'button' : 'h3'}
          onClick={onOpen}
          sx={
            onOpen
              ? {
                  p: 0,
                  border: 0,
                  cursor: 'pointer',
                  color: 'text.primary',
                  bgcolor: 'transparent',
                  '&:hover': { color: 'primary.main' },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                }
              : undefined
          }
        >
          {sprint.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {fDate(sprint.startDate, 'DD MMM')} — {fDate(sprint.endDate, 'DD MMM YYYY')}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 0.75,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sprint.goal}
        </Typography>
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Velocity
          </Typography>
          <Typography variant="subtitle2">
            {sprint.completedPoints} / {sprint.plannedPoints} points
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, (sprint.completedPoints / scaleMax) * 100)}
          aria-label={`${sprint.name} velocity`}
          sx={{ mt: 1, height: 7 }}
        />
        <Typography variant="caption" sx={{ mt: 0.75, display: 'block', color: 'text.disabled' }}>
          {sprint.completedIssueCount} completed ·{' '}
          {sprint.incompleteIssueCount ?? sprint.issueCount - sprint.completedIssueCount} incomplete
          {' · '}
          {sprint.incompletePoints ?? sprint.plannedPoints - sprint.completedPoints} incomplete
          points
          {' · '}
          {Math.round(completionRate)}%
        </Typography>
      </Box>

      <Box sx={{ textAlign: { xs: 'left', md: 'right' } }}>
        <Label color="success" variant="soft">
          Completed
        </Label>
        <Typography variant="caption" sx={{ mt: 0.75, display: 'block', color: 'text.secondary' }}>
          {fDate(sprint.completedAt, 'DD MMM YYYY')}
        </Typography>
      </Box>
    </Box>
  );
}
