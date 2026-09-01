'use client';

import type { IconifyName } from 'src/components/iconify';

import { useId } from 'react';
import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { fDate } from 'src/utils/format-time';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

export type PlannedSprintCardProps = {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  issueCount: number;
  plannedPoints: number;
  loading?: boolean;
  canStart?: boolean;
  startDisabledReason?: string;
  onStart: () => void;
  onOpen?: () => void;
};

export function PlannedSprintCard({
  name,
  goal,
  startDate,
  endDate,
  issueCount,
  plannedPoints,
  loading = false,
  canStart = false,
  startDisabledReason = 'Add at least one issue before starting this sprint.',
  onStart,
  onOpen,
}: PlannedSprintCardProps) {
  const startHelpId = `${useId()}-start-help`;
  const startButton = (
    <Button
      size="small"
      variant="contained"
      loading={loading}
      disabled={!canStart}
      onClick={onStart}
      aria-label={`Start ${name}`}
      aria-describedby={!canStart ? startHelpId : undefined}
      startIcon={<Iconify icon="solar:play-circle-bold" />}
    >
      Start
    </Button>
  );

  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        height: 1,
        overflow: 'visible',
        transition: theme.transitions.create(['border-color', 'box-shadow', 'transform'], {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: varAlpha(theme.vars.palette.primary.mainChannel, 0.32),
          boxShadow: `0 14px 34px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
        },
      })}
    >
      <CardContent sx={{ height: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ gap: 1, display: 'flex', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="overline" sx={{ color: 'primary.main' }}>
              Planned sprint
            </Typography>
            <Typography
              variant="h6"
              component={onOpen ? 'button' : 'h3'}
              onClick={onOpen}
              sx={
                onOpen
                  ? {
                      p: 0,
                      border: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: 'text.primary',
                      bgcolor: 'transparent',
                      '&:hover': { color: 'primary.main' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                    }
                  : undefined
              }
            >
              {name}
            </Typography>
          </Box>
          <Label variant="soft">{fDate(startDate, 'DD MMM')} start</Label>
        </Box>

        <Typography
          variant="body2"
          sx={{
            mt: 1.5,
            color: 'text.secondary',
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {goal}
        </Typography>

        <Typography variant="caption" sx={{ mt: 1.25, color: 'text.disabled' }}>
          {fDate(startDate, 'DD MMM YYYY')} — {fDate(endDate, 'DD MMM YYYY')}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 'auto', pt: 3, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
        >
          <Metric icon="solar:list-bold" label={`${issueCount} issues`} />
          <Metric icon="solar:chart-square-outline" label={`${plannedPoints} points`} />
          <Box sx={{ flexGrow: 1 }} />
          {startButton}
        </Stack>
        {!canStart && (
          <Typography
            id={startHelpId}
            variant="caption"
            sx={{ mt: 1, color: 'text.secondary', textAlign: 'right' }}
          >
            {startDisabledReason}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label }: { icon: IconifyName; label: string }) {
  return (
    <Box sx={{ gap: 0.75, display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
      <Iconify icon={icon} width={18} />
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}
