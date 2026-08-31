'use client';

import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import LinearProgress from '@mui/material/LinearProgress';

import { fDate } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

export type ActiveSprintSummaryProps = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  totalIssueCount: number;
  completedIssueCount: number;
  plannedPoints: number;
  completedPoints: number;
  loading?: boolean;
  onComplete: () => void;
  onOpenBoard?: () => void;
};

export function ActiveSprintSummary({
  name,
  goal,
  startDate,
  endDate,
  totalIssueCount,
  completedIssueCount,
  plannedPoints,
  completedPoints,
  loading = false,
  onComplete,
  onOpenBoard,
}: ActiveSprintSummaryProps) {
  const progress = plannedPoints > 0 ? Math.min(100, (completedPoints / plannedPoints) * 100) : 0;

  return (
    <Card
      sx={(theme) => ({
        color: 'primary.darker',
        background: `linear-gradient(135deg, ${varAlpha(theme.vars.palette.primary.lighterChannel, 0.92)}, ${varAlpha(theme.vars.palette.info.lighterChannel, 0.62)})`,
        boxShadow: 'none',
        border: `solid 1px ${varAlpha(theme.vars.palette.primary.mainChannel, 0.16)}`,
        ...theme.applyStyles('dark', {
          color: 'primary.lighter',
          background: `linear-gradient(135deg, ${varAlpha(theme.vars.palette.primary.darkerChannel, 0.72)}, ${varAlpha(theme.vars.palette.info.darkerChannel, 0.38)})`,
        }),
      })}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
        <Box
          sx={{
            gap: 3,
            display: 'grid',
            alignItems: 'start',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          }}
        >
          <Box>
            <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
              <Label
                color="success"
                variant="filled"
                startIcon={<Iconify icon="solar:electric-refueling-bold" />}
              >
                Active
              </Label>
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: 'inherit', opacity: 0.72 }}
              >
                {fDate(startDate, 'DD MMM')} — {fDate(endDate, 'DD MMM YYYY')}
              </Typography>
            </Box>

            <Typography component="h2" variant="h4" sx={{ mt: 1.5 }}>
              {name}
            </Typography>
            <Typography sx={{ mt: 0.75, maxWidth: 720, color: 'inherit', opacity: 0.78 }}>
              {goal}
            </Typography>

            <Box sx={{ mt: 3, maxWidth: 640 }}>
              <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Delivery progress</Typography>
                <Typography variant="subtitle2">{Math.round(progress)}%</Typography>
              </Box>
              <LinearProgress
                value={progress}
                variant="determinate"
                aria-label={`${name} completion progress`}
                sx={{ height: 8, bgcolor: 'action.hover' }}
              />
              <Box
                sx={{
                  mt: 1.25,
                  gap: 2,
                  display: 'flex',
                  flexWrap: 'wrap',
                  color: 'inherit',
                  opacity: 0.72,
                }}
              >
                <Typography variant="caption">
                  {completedPoints} / {plannedPoints} points complete
                </Typography>
                <Typography variant="caption">
                  {completedIssueCount} / {totalIssueCount} issues done
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              gap: 1,
              display: 'flex',
              flexWrap: 'wrap',
              flexDirection: { xs: 'row', md: 'column' },
              '& .MuiButton-root': { flexGrow: { xs: 1, sm: 0 } },
            }}
          >
            <Button
              color="primary"
              variant="contained"
              loading={loading}
              onClick={onComplete}
              startIcon={<Iconify icon="solar:flag-bold" />}
            >
              Complete sprint
            </Button>
            {onOpenBoard && (
              <Button
                color="inherit"
                variant="outlined"
                onClick={onOpenBoard}
                startIcon={<Iconify icon="solar:box-minimalistic-bold" />}
                sx={{ borderColor: 'currentColor' }}
              >
                Open board
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
