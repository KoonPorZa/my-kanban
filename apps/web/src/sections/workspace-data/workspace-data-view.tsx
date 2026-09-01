'use client';

import type { ChangeEvent } from 'react';
import type {
  DeletionCandidates,
  WorkspaceImportMode,
  WorkspaceImportPreview,
} from 'src/actions/workspace-transfer';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Radio from '@mui/material/Radio';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import CardContent from '@mui/material/CardContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useDelayedDelete } from 'src/hooks/use-delayed-delete';

import { getQueryClient } from 'src/lib/query-client';
import { DashboardContent } from 'src/layouts/dashboard';
import {
  importWorkspace,
  restoreArchivedIssue,
  getDeletionCandidates,
  previewWorkspaceImport,
  permanentlyDeleteIssue,
  downloadWorkspaceExport,
  permanentlyDeleteSprint,
  permanentlyDeleteProject,
} from 'src/actions/workspace-transfer';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { getErrorMessage } from 'src/auth/utils';

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

type DeleteTarget =
  | { kind: 'project'; item: DeletionCandidates['projects'][number] }
  | { kind: 'sprint'; item: DeletionCandidates['sprints'][number] }
  | { kind: 'issue'; item: DeletionCandidates['issues'][number] };

export function WorkspaceDataView() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<WorkspaceImportMode>('merge');
  const [preview, setPreview] = useState<WorkspaceImportPreview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [candidates, setCandidates] = useState<DeletionCandidates | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scheduleDelete = useDelayedDelete();

  const loadCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    try {
      setCandidates(await getDeletionCandidates());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadWorkspaceExport();
      toast.success('Workspace export downloaded');
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setExporting(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setReviewError(null);
    setPreview(null);
    if (nextFile && nextFile.size > MAX_IMPORT_BYTES) {
      setFile(null);
      setError('Import files must be 10 MB or smaller.');
      return;
    }
    setFile(nextFile);
  };

  const handleReview = async () => {
    if (!file) return;
    setReviewing(true);
    setReviewError(null);
    setPreview(null);
    try {
      const result = await previewWorkspaceImport(file, mode);
      setPreview(result);
      setConfirmOpen(true);
    } catch (cause) {
      setReviewError(getErrorMessage(cause));
    } finally {
      setReviewing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importWorkspace(file, mode);
      await getQueryClient().invalidateQueries();
      await loadCandidates();
      setConfirmOpen(false);
      setFile(null);
      setPreview(null);
      toast.success(
        `${result.projectCount} project${result.projectCount === 1 ? '' : 's'} imported`
      );
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setImporting(false);
    }
  };

  const restoreIssue = async (issue: DeletionCandidates['issues'][number]) => {
    setError(null);
    try {
      await restoreArchivedIssue(issue.id, issue.version);
      await getQueryClient().invalidateQueries();
      await loadCandidates();
      toast.success(`${issue.title} restored`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  };

  const schedulePermanentDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    scheduleDelete({
      label: targetLabel(target),
      operation: () => deleteOperation(target),
      onComplete: () => {
        toast.success(`${targetLabel(target)} permanently deleted`);
        void getQueryClient().invalidateQueries();
        void loadCandidates();
      },
      onError: (cause) => {
        setError(getErrorMessage(cause));
        void loadCandidates();
      },
    });
  };

  return (
    <DashboardContent maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4">Workspace data</Typography>
        <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
          Keep a portable copy of your projects, boards, tasks, and Sprints.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        }}
      >
        <DataCard
          icon="solar:file-check-bold-duotone"
          title="Export workspace"
          description="Download schema v1 JSON. Login, session, AI access tokens, audit events, and other secrets are never included."
        >
          <Button
            variant="contained"
            loading={exporting}
            onClick={handleExport}
            startIcon={<Iconify icon="solar:download-bold" />}
          >
            Download export
          </Button>
        </DataCard>

        <DataCard
          icon="solar:file-bold-duotone"
          title="Import workspace"
          description="Choose a My Kanban schema v1 JSON export. Validation completes before any data is written."
        >
          <Button
            component="label"
            color="inherit"
            variant="outlined"
            startIcon={<Iconify icon="solar:import-bold" />}
          >
            Choose JSON file
            <input hidden type="file" accept="application/json,.json" onChange={handleFile} />
          </Button>
          <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
            {file ? `${file.name} · ${formatBytes(file.size)}` : 'Maximum file size: 10 MB'}
          </Typography>

          <RadioGroup
            value={mode}
            onChange={(event) => {
              setMode(event.target.value as WorkspaceImportMode);
              setPreview(null);
              setReviewError(null);
            }}
            sx={{ mt: 2 }}
          >
            <FormControlLabel
              value="merge"
              control={<Radio />}
              label="Merge · add missing entities and apply only newer imported versions"
            />
            <FormControlLabel
              value="replace"
              control={<Radio />}
              label="Replace · archive projects outside this export"
            />
          </RadioGroup>

          <Button
            color={mode === 'replace' ? 'error' : 'primary'}
            variant="contained"
            disabled={!file}
            loading={reviewing}
            onClick={handleReview}
            sx={{ mt: 2 }}
          >
            Review import
          </Button>
          {reviewError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle2">Import file did not pass review</Typography>
              <Typography variant="body2">{reviewError}</Typography>
            </Alert>
          )}
        </DataCard>
      </Box>

      <Alert severity="info" icon={<Iconify icon="solar:shield-check-bold" />} sx={{ mt: 3 }}>
        Imports are owner-scoped and transactional. Invalid or conflicting files make no partial
        changes.
      </Alert>

      <Dialog
        fullWidth
        maxWidth="sm"
        open={confirmOpen}
        onClose={importing ? undefined : () => setConfirmOpen(false)}
      >
        <DialogTitle>
          {mode === 'replace' ? 'Replace workspace data?' : 'Merge workspace data?'}
        </DialogTitle>
        <DialogContent>
          <Alert severity={mode === 'replace' ? 'warning' : 'info'} icon={false}>
            {mode === 'replace'
              ? 'Exportable board data is restored exactly. Projects not present in the export are archived; authentication and AI credentials remain untouched.'
              : 'Missing entities are added. Matching entities update only when the file has a newer updatedAt; destination-only and newer destination data remain unchanged.'}
          </Alert>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            File: {file?.name}
          </Typography>
          {preview && <ImportPreviewSummary preview={preview} />}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" disabled={importing} onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            color={mode === 'replace' ? 'error' : 'primary'}
            variant="contained"
            loading={importing}
            disabled={!preview}
            onClick={handleImport}
          >
            {mode === 'replace' ? 'Replace data' : 'Merge data'}
          </Button>
        </DialogActions>
      </Dialog>

      <RecoveryPanel
        candidates={candidates}
        loading={candidatesLoading}
        onRetry={loadCandidates}
        onRestoreIssue={restoreIssue}
        onDelete={setDeleteTarget}
      />

      <Dialog
        fullWidth
        maxWidth="sm"
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      >
        <DialogTitle>
          Permanently delete {deleteTarget ? targetLabel(deleteTarget) : ''}?
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" icon={false}>
            {deleteTarget ? deleteImpact(deleteTarget) : ''} This cannot be restored from the app.
          </Alert>
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            After confirmation, deletion waits 5 seconds. Use Undo in the notification to cancel
            before the request is sent.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={schedulePermanentDelete}>
            Permanently delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardContent>
  );
}

export function ImportPreviewSummary({ preview }: { preview: WorkspaceImportPreview }) {
  const metrics = [
    ['Projects', preview.counts.projects],
    ['Columns', preview.counts.columns],
    ['Sprints', preview.counts.sprints],
    ['Tasks', preview.counts.issues],
    ['Checklist items', preview.counts.checklistItems],
  ] as const;

  return (
    <Box sx={{ mt: 2.5 }}>
      <Typography variant="subtitle2">Validated schema v{preview.schemaVersion}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Workspace: {preview.workspaceName}
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          gap: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(5, 1fr)' },
        }}
      >
        {metrics.map(([label, value]) => (
          <Box
            key={label}
            sx={{ p: 1.25, border: 1, borderColor: 'divider', borderRadius: 1.5, minWidth: 0 }}
          >
            <Typography variant="h6">{value}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
        {preview.impact.newProjects} new · {preview.impact.matchingProjects} matching
        {preview.mode === 'replace'
          ? ` · ${preview.impact.projectsToArchive} destination-only Projects will be archived`
          : ' · destination-only Projects will remain unchanged'}
      </Typography>
    </Box>
  );
}

function RecoveryPanel({
  candidates,
  loading,
  onRetry,
  onRestoreIssue,
  onDelete,
}: {
  candidates: DeletionCandidates | null;
  loading: boolean;
  onRetry: () => Promise<void>;
  onRestoreIssue: (issue: DeletionCandidates['issues'][number]) => Promise<void>;
  onDelete: (target: DeleteTarget) => void;
}) {
  const empty =
    !loading &&
    candidates &&
    !candidates.projects.length &&
    !candidates.sprints.length &&
    !candidates.issues.length;

  return (
    <Card variant="outlined" sx={{ mt: 4 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Recovery and permanent deletion</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
              Restore archived tasks later, or review the full impact before scheduling permanent
              deletion.
            </Typography>
          </Box>
          <Button color="inherit" loading={loading} onClick={() => void onRetry()}>
            Refresh
          </Button>
        </Box>

        {empty && (
          <Alert severity="success" icon={false} sx={{ mt: 3 }}>
            No archived tasks, archived Projects, or non-active Sprint records need attention.
          </Alert>
        )}

        {candidates && candidates.issues.length > 0 && (
          <CandidateSection title="Archived tasks">
            {candidates.issues.map((issue) => (
              <CandidateRow
                key={issue.id}
                title={issue.title}
                detail={`${issue.projectName} · ${issue.checklistCount} checklist items`}
                actions={
                  <>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<Iconify icon="solar:restart-bold" />}
                      onClick={() => void onRestoreIssue(issue)}
                    >
                      Restore
                    </Button>
                    <DeleteButton onClick={() => onDelete({ kind: 'issue', item: issue })} />
                  </>
                }
              />
            ))}
          </CandidateSection>
        )}

        {candidates && candidates.sprints.length > 0 && (
          <CandidateSection title="Non-active Sprint records">
            {candidates.sprints.map((sprint) => (
              <CandidateRow
                key={sprint.id}
                title={sprint.name}
                detail={`${sprint.projectName} · ${sprint.status} · ${sprint.issueCount} assigned tasks`}
                actions={
                  <DeleteButton onClick={() => onDelete({ kind: 'sprint', item: sprint })} />
                }
              />
            ))}
          </CandidateSection>
        )}

        {candidates && candidates.projects.length > 0 && (
          <CandidateSection title="Archived Projects">
            {candidates.projects.map((project) => (
              <CandidateRow
                key={project.id}
                title={project.name}
                detail={`${project.columnCount} columns · ${project.issueCount} tasks · ${project.sprintCount} Sprints · ${project.mcpTokenCount} AI credentials · ${project.mcpAuditEventCount} total MCP audit events`}
                actions={
                  <DeleteButton onClick={() => onDelete({ kind: 'project', item: project })} />
                }
              />
            ))}
          </CandidateSection>
        )}
      </CardContent>
    </Card>
  );
}

function CandidateSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>{children}</Box>
    </Box>
  );
}

function CandidateRow({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        p: 1.75,
        gap: 2,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {detail}
        </Typography>
      </Box>
      <Box sx={{ gap: 1, display: 'flex' }}>{actions}</Box>
    </Box>
  );
}

function DeleteButton({ disabled = false, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <Button
      size="small"
      color="error"
      variant="soft"
      disabled={disabled}
      startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
      onClick={onClick}
    >
      Permanently delete
    </Button>
  );
}

function targetLabel(target: DeleteTarget) {
  if (target.kind === 'issue') return target.item.title;
  return target.item.name;
}

function deleteImpact(target: DeleteTarget) {
  if (target.kind === 'project') {
    return `${target.item.columnCount} columns, ${target.item.issueCount} tasks, ${target.item.sprintCount} Sprints, ${target.item.mcpTokenCount} AI credentials, and ${target.item.mcpAuditEventCount} total MCP audit events will be deleted with this Project. Any audit event inside the mandatory 90-day retention window blocks deletion.`;
  }
  if (target.kind === 'sprint') {
    return `${target.item.issueCount} assigned tasks will move to the backlog before this Sprint record is deleted.`;
  }
  return `The task and its ${target.item.checklistCount} checklist items will be deleted.`;
}

function deleteOperation(target: DeleteTarget) {
  if (target.kind === 'project') {
    return permanentlyDeleteProject(target.item.id, target.item.version);
  }
  if (target.kind === 'sprint') {
    return permanentlyDeleteSprint(target.item.id, target.item.version);
  }
  return permanentlyDeleteIssue(target.item.id, target.item.version);
}

function DataCard({
  icon,
  title,
  description,
  children,
}: {
  icon: 'solar:file-check-bold-duotone' | 'solar:file-bold-duotone';
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 3 }}>
        <Iconify icon={icon} width={40} sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, minHeight: 64, color: 'text.secondary' }}>
          {description}
        </Typography>
        <Divider sx={{ my: 2.5 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
