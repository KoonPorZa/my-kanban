'use client';

import type { FormEvent, MouseEvent } from 'react';
import type { ProjectSummaryDto, ProjectListResponseDto } from '@my-kanban/api-client';

import { isAxiosError } from 'axios';
import { useState, useEffect } from 'react';
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useArchiveProject,
  useActivateProject,
  getListProjectsQueryKey,
} from '@my-kanban/api-client';

import Box from '@mui/material/Box';
import Menu from '@mui/material/Menu';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';

import { getQueryClient } from 'src/lib/query-client';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

const PROJECT_COLORS = ['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const;
const DONE_RETENTION_OPTIONS = [7, 14, 30] as const;

export function ProjectSwitcher() {
  const queryClient = getQueryClient();
  const projectsQuery = useListProjects({ query: { staleTime: 30_000 } });
  const activateMutation = useActivateProject();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectSummaryDto | null>(null);

  const data = projectsQuery.data;
  const activeProject = data?.projects.find((project) => project.id === data.activeProjectId);

  const openCreate = () => {
    setAnchorEl(null);
    setEditingProject(null);
    setDialogOpen(true);
  };

  const openSettings = (event: MouseEvent, project: ProjectSummaryDto) => {
    event.stopPropagation();
    setAnchorEl(null);
    setEditingProject(project);
    setDialogOpen(true);
  };

  const activate = async (project: ProjectSummaryDto) => {
    setAnchorEl(null);
    if (project.id === data?.activeProjectId) return;
    try {
      await activateMutation.mutateAsync({ projectId: project.id });
      queryClient.setQueryData<ProjectListResponseDto>(getListProjectsQueryKey(), (current) =>
        current ? { ...current, activeProjectId: project.id } : current
      );
      await queryClient.invalidateQueries();
      toast.success(`Switched to ${project.name}`);
    } catch (error) {
      toast.error(projectErrorMessage(error));
    }
  };

  const busy = projectsQuery.isLoading || activateMutation.isPending;

  return (
    <>
      <Button
        size="small"
        color="inherit"
        variant="outlined"
        disabled={busy}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        startIcon={
          busy ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <ProjectColor color={activeProject?.color} />
          )
        }
        endIcon={<Iconify icon="eva:chevron-down-fill" />}
        aria-haspopup="menu"
        aria-expanded={Boolean(anchorEl)}
        sx={{ minHeight: { xs: 44, sm: 0 } }}
      >
        {activeProject?.name ?? 'Projects'}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 300, mt: 0.75 } } }}
      >
        {data?.projects.map((project) => (
          <MenuItem
            key={project.id}
            selected={project.id === data.activeProjectId}
            onClick={() => void activate(project)}
            sx={{ gap: 1.5, minHeight: 52 }}
          >
            <ProjectColor color={project.color} />
            <ListItemText
              primary={project.name}
              secondary={project.mode === 'scrum' ? 'Scrum project' : 'Kanban project'}
              slotProps={{ primary: { noWrap: true }, secondary: { variant: 'caption' } }}
            />
            <IconButton
              size="small"
              aria-label={`Edit ${project.name}`}
              onClick={(event) => openSettings(event, project)}
            >
              <Iconify icon="solar:settings-bold" width={18} />
            </IconButton>
          </MenuItem>
        ))}
        {!data?.projects.length && (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Create a project to start planning work.
            </Typography>
          </Box>
        )}
        <MenuItem
          onClick={openCreate}
          sx={{ gap: 1.5, mt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}
        >
          <Iconify icon="mingcute:add-line" />
          Create project
        </MenuItem>
      </Menu>

      <ProjectDialog
        open={dialogOpen}
        project={editingProject}
        onClose={() => setDialogOpen(false)}
        onChanged={async (nextProjects) => {
          if (nextProjects) {
            queryClient.setQueryData(getListProjectsQueryKey(), nextProjects);
          }
          await queryClient.invalidateQueries();
          setDialogOpen(false);
        }}
      />
    </>
  );
}

type ProjectDialogProps = {
  open: boolean;
  project: ProjectSummaryDto | null;
  onClose: () => void;
  onChanged: (projects?: ProjectListResponseDto) => Promise<void>;
};

function ProjectDialog({ open, project, onClose, onChanged }: ProjectDialogProps) {
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const archiveMutation = useArchiveProject();
  const [name, setName] = useState('');
  const [color, setColor] = useState<(typeof PROJECT_COLORS)[number]>('primary');
  const [mode, setMode] = useState<'kanban' | 'scrum'>('kanban');
  const [doneRetentionDays, setDoneRetentionDays] = useState<7 | 14 | 30>(30);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? '');
    setColor(normalizeProjectColor(project?.color));
    setMode(project?.mode ?? 'kanban');
    setDoneRetentionDays(project?.doneRetentionDays ?? 30);
    setError(null);
    setArchiveOpen(false);
  }, [open, project]);

  const busy = createMutation.isPending || updateMutation.isPending || archiveMutation.isPending;
  const canSubmit = Boolean(name.trim()) && !busy;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      if (project) {
        await updateMutation.mutateAsync({
          projectId: project.id,
          data: { version: project.version, name, color, mode, doneRetentionDays },
        });
        toast.success('Project settings saved');
      } else {
        await createMutation.mutateAsync({ data: { name, color, mode } });
        toast.success('Project created');
      }
      await onChanged();
    } catch (mutationError) {
      setError(projectErrorMessage(mutationError));
    }
  };

  const archive = async () => {
    if (!project) return;
    setError(null);
    try {
      const projects = await archiveMutation.mutateAsync({
        projectId: project.id,
        data: { version: project.version },
      });
      toast.success(`${project.name} archived`);
      setArchiveOpen(false);
      await onChanged(projects);
    } catch (mutationError) {
      setArchiveOpen(false);
      setError(projectErrorMessage(mutationError));
    }
  };

  return (
    <>
      <Dialog fullWidth maxWidth="sm" open={open} onClose={busy ? undefined : onClose}>
        <Box component="form" onSubmit={submit}>
          <DialogTitle>{project ? 'Project settings' : 'Create project'}</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2.5, pt: '8px !important' }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              autoFocus
              required
              fullWidth
              label="Project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <Box
              sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}
            >
              <FormControl fullWidth>
                <InputLabel id="project-color-label">Color</InputLabel>
                <Select
                  labelId="project-color-label"
                  label="Color"
                  value={color}
                  onChange={(event) => setColor(event.target.value as typeof color)}
                >
                  {PROJECT_COLORS.map((option) => (
                    <MenuItem
                      key={option}
                      value={option}
                      sx={{ gap: 1.25, textTransform: 'capitalize' }}
                    >
                      <ProjectColor color={option} />
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="project-mode-label">Workflow</InputLabel>
                <Select
                  labelId="project-mode-label"
                  label="Workflow"
                  value={mode}
                  onChange={(event) => setMode(event.target.value as typeof mode)}
                >
                  <MenuItem value="kanban">Kanban</MenuItem>
                  <MenuItem value="scrum">Scrum</MenuItem>
                </Select>
              </FormControl>
            </Box>
            {project && (
              <FormControl fullWidth>
                <InputLabel id="done-retention-label">Show completed tasks</InputLabel>
                <Select
                  labelId="done-retention-label"
                  label="Show completed tasks"
                  value={doneRetentionDays}
                  onChange={(event) =>
                    setDoneRetentionDays(Number(event.target.value) as 7 | 14 | 30)
                  }
                >
                  {DONE_RETENTION_OPTIONS.map((days) => (
                    <MenuItem key={days} value={days}>
                      Last {days} days
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {mode === 'scrum' && (
              <Alert severity="info" icon={false}>
                Scrum projects use the backlog and Active Sprint view. An active Sprint must be
                completed before switching back to Kanban.
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: project ? 'space-between' : 'flex-end' }}>
            {project && (
              <Button color="error" disabled={busy} onClick={() => setArchiveOpen(true)}>
                Archive
              </Button>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" loading={busy} disabled={!canSubmit}>
                {project ? 'Save changes' : 'Create project'}
              </Button>
            </Box>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        title={`Archive ${project?.name ?? 'project'}?`}
        content="The project will disappear from your selector. Its tasks, columns, and Sprint history are preserved."
        onClose={() => setArchiveOpen(false)}
        cancelDisabled={archiveMutation.isPending}
        action={
          <Button
            color="error"
            variant="contained"
            loading={archiveMutation.isPending}
            onClick={() => void archive()}
          >
            Archive project
          </Button>
        }
      />
    </>
  );
}

function ProjectColor({ color = 'primary' }: { color?: string }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 12,
        height: 12,
        flexShrink: 0,
        borderRadius: '50%',
        bgcolor: `${normalizeProjectColor(color)}.main`,
        boxShadow: (theme) => `0 0 0 3px ${theme.vars.palette.background.paper}`,
      }}
    />
  );
}

function normalizeProjectColor(color?: string): (typeof PROJECT_COLORS)[number] {
  return PROJECT_COLORS.find((option) => option === color) ?? 'primary';
}

function projectErrorMessage(error: unknown) {
  if (isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? 'The project could not be changed.';
  }
  return 'The project could not be changed.';
}
