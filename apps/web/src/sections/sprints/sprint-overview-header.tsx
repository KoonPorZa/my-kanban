'use client';

import type { BoxProps } from '@mui/material/Box';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

export type SprintOverviewHeaderProps = BoxProps & {
  projectName: string;
  activeSprintName?: string | null;
  plannedSprintCount: number;
  createDisabled?: boolean;
  onCreateSprint: () => void;
};

export function SprintOverviewHeader({
  sx,
  projectName,
  activeSprintName,
  plannedSprintCount,
  createDisabled = false,
  onCreateSprint,
  ...other
}: SprintOverviewHeaderProps) {
  return (
    <Box
      component="header"
      sx={[
        {
          gap: 2,
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Box sx={{ gap: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="h4">Sprints</Typography>
          <Label color={activeSprintName ? 'success' : 'default'} variant="soft">
            {activeSprintName ? 'Sprint active' : 'Ready to plan'}
          </Label>
        </Box>

        <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
          {activeSprintName
            ? `${activeSprintName} is in progress for ${projectName}.`
            : `Shape the next delivery cycle for ${projectName}.`}{' '}
          {plannedSprintCount === 0
            ? 'No planned sprints yet.'
            : `${plannedSprintCount} planned sprint${plannedSprintCount === 1 ? '' : 's'} waiting.`}
        </Typography>
      </Box>

      <Button
        variant="contained"
        disabled={createDisabled}
        onClick={onCreateSprint}
        startIcon={<Iconify icon="mingcute:add-line" />}
      >
        Create sprint
      </Button>
    </Box>
  );
}
