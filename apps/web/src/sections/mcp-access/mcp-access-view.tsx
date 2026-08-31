'use client';

import type {
  McpTokenResponseDto,
  CreatedMcpTokenResponseDto,
  CreateMcpTokenDtoClientType,
} from '@my-kanban/api-client';

import { useState, useEffect } from 'react';
import {
  useListProjects,
  useListMcpTokens,
  useCreateMcpToken,
  useRevokeMcpToken,
  useListMcpAuditEvents,
  getListMcpTokensQueryKey,
  getListMcpAuditEventsQueryKey,
} from '@my-kanban/api-client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';

import { fDateTime } from 'src/utils/format-time';

import { getQueryClient } from 'src/lib/query-client';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

type ViewTab = 'tokens' | 'audit';

export function McpAccessView() {
  const [tab, setTab] = useState<ViewTab>('tokens');
  const [projectId, setProjectId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedMcpTokenResponseDto | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<McpTokenResponseDto | null>(null);

  const projectsQuery = useListProjects();
  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (!projectId && projectsQuery.data?.activeProjectId) {
      setProjectId(projectsQuery.data.activeProjectId);
    }
  }, [projectId, projectsQuery.data?.activeProjectId]);

  const tokensQuery = useListMcpTokens(projectId, {
    query: { enabled: Boolean(projectId), refetchOnWindowFocus: true },
  });
  const auditQuery = useListMcpAuditEvents(projectId, {
    query: { enabled: Boolean(projectId) && tab === 'audit', refetchOnWindowFocus: true },
  });
  const createMutation = useCreateMcpToken();
  const revokeMutation = useRevokeMcpToken();

  const invalidate = async () => {
    const queryClient = getQueryClient();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListMcpTokensQueryKey(projectId) }),
      queryClient.invalidateQueries({ queryKey: getListMcpAuditEventsQueryKey(projectId) }),
    ]);
  };

  const createToken = async (label: string, clientType: CreateMcpTokenDtoClientType) => {
    const token = await createMutation.mutateAsync({ projectId, data: { label, clientType } });
    setCreateOpen(false);
    setCreatedToken(token);
    await invalidate();
  };

  const revokeToken = async () => {
    if (!revokeTarget) return;
    await revokeMutation.mutateAsync({ projectId, tokenId: revokeTarget.id });
    setRevokeTarget(null);
    await invalidate();
    toast.success('Token revoked');
  };

  return (
    <DashboardContent maxWidth="xl">
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          gap: 2,
          alignItems: { xs: 'flex-start', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' },
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">AI project access</Typography>
          <Typography sx={{ mt: 0.75, color: 'text.secondary' }}>
            Issue one 90-day credential per Codex or Claude session. Every token is locked to one
            Project.
          </Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: 240 }}>
          <InputLabel id="mcp-project-label">Project</InputLabel>
          <Select
            label="Project"
            labelId="mcp-project-label"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          disabled={!projectId}
          startIcon={<Iconify icon="mingcute:add-line" />}
          onClick={() => setCreateOpen(true)}
        >
          Create token
        </Button>
      </Box>

      <Alert
        severity="info"
        icon={<Iconify icon="solar:shield-keyhole-bold-duotone" />}
        sx={{ mb: 3 }}
      >
        Raw tokens appear once and are never stored by the Web app. Store them in macOS Keychain
        with the <code>kanban</code> helper.
      </Alert>

      <Card>
        <Tabs value={tab} onChange={(_event, value: ViewTab) => setTab(value)} sx={{ px: 3 }}>
          <Tab value="tokens" label="Access tokens" />
          <Tab value="audit" label="Mutation audit" />
        </Tabs>

        {tab === 'tokens' ? (
          <TokenTable
            loading={tokensQuery.isLoading}
            tokens={tokensQuery.data ?? []}
            onRevoke={setRevokeTarget}
          />
        ) : (
          <AuditTable loading={auditQuery.isLoading} events={auditQuery.data ?? []} />
        )}
      </Card>

      <CreateTokenDialog
        open={createOpen}
        loading={createMutation.isPending}
        onClose={() => setCreateOpen(false)}
        onCreate={createToken}
      />

      <CreatedTokenDialog token={createdToken} onClose={() => setCreatedToken(null)} />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revoke this token?"
        content={`Sessions using “${revokeTarget?.label ?? ''}” will lose access immediately.`}
        onClose={() => setRevokeTarget(null)}
        action={
          <Button
            color="error"
            variant="contained"
            loading={revokeMutation.isPending}
            onClick={revokeToken}
          >
            Revoke
          </Button>
        }
      />
    </DashboardContent>
  );
}

function TokenTable({
  loading,
  tokens,
  onRevoke,
}: {
  loading: boolean;
  tokens: McpTokenResponseDto[];
  onRevoke: (token: McpTokenResponseDto) => void;
}) {
  if (loading) return <LoadingTable />;
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Client</TableCell>
            <TableCell>Prefix</TableCell>
            <TableCell>Last used</TableCell>
            <TableCell>Expires</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {tokens.map((token) => {
            const expired = new Date(token.expiresAt) <= new Date();
            const disabled = Boolean(token.revokedAt) || expired;
            return (
              <TableRow key={token.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{token.label}</Typography>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', textTransform: 'capitalize' }}
                  >
                    {token.clientType}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box component="code">mkp_{token.tokenPrefix}_…</Box>
                </TableCell>
                <TableCell>{token.lastUsedAt ? fDateTime(token.lastUsedAt) : 'Never'}</TableCell>
                <TableCell>{fDateTime(token.expiresAt)}</TableCell>
                <TableCell>
                  <Label color={disabled ? 'error' : 'success'}>
                    {token.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Active'}
                  </Label>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Revoke token">
                    <span>
                      <IconButton color="error" disabled={disabled} onClick={() => onRevoke(token)}>
                        <Iconify icon="solar:trash-bin-trash-bold" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
          {!tokens.length && <EmptyRow message="No AI access tokens for this Project." />}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function AuditTable({
  loading,
  events,
}: {
  loading: boolean;
  events: Array<{
    id: string;
    tokenLabel: string;
    toolName: string;
    outcome: string;
    requestId: string;
    createdAt: string;
  }>;
}) {
  if (loading) return <LoadingTable />;
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Token</TableCell>
            <TableCell>Tool</TableCell>
            <TableCell>Outcome</TableCell>
            <TableCell>Request</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id} hover>
              <TableCell>{fDateTime(event.createdAt)}</TableCell>
              <TableCell>{event.tokenLabel}</TableCell>
              <TableCell>
                <Box component="code">{event.toolName}</Box>
              </TableCell>
              <TableCell>
                <Label
                  color={
                    event.outcome === 'success'
                      ? 'success'
                      : event.outcome === 'rejected'
                        ? 'warning'
                        : 'error'
                  }
                >
                  {event.outcome}
                </Label>
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                  {event.requestId.slice(0, 12)}…
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {!events.length && (
            <EmptyRow message="No MCP mutations have been recorded." colSpan={5} />
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CreateTokenDialog({
  open,
  loading,
  onClose,
  onCreate,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onCreate: (label: string, clientType: CreateMcpTokenDtoClientType) => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [clientType, setClientType] = useState<CreateMcpTokenDtoClientType>('codex');
  const submit = async () => {
    if (!label.trim()) return;
    await onCreate(label.trim(), clientType);
    setLabel('');
  };
  return (
    <Dialog fullWidth maxWidth="xs" open={open} onClose={onClose}>
      <DialogTitle>Create Project token</DialogTitle>
      <DialogContent sx={{ pt: 1, display: 'grid', gap: 2.5 }}>
        <TextField
          autoFocus
          label="Client label"
          placeholder="Codex on MacBook"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          inputProps={{ maxLength: 80 }}
        />
        <FormControl fullWidth>
          <InputLabel>Client</InputLabel>
          <Select
            label="Client"
            value={clientType}
            onChange={(event) => setClientType(event.target.value as CreateMcpTokenDtoClientType)}
          >
            <MenuItem value="codex">Codex CLI</MenuItem>
            <MenuItem value="claude">Claude Code</MenuItem>
            <MenuItem value="other">Other MCP client</MenuItem>
          </Select>
        </FormControl>
        <Alert severity="warning">This credential expires exactly 90 days after creation.</Alert>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" loading={loading} disabled={!label.trim()} onClick={submit}>
          Create token
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CreatedTokenDialog({
  token,
  onClose,
}: {
  token: CreatedMcpTokenResponseDto | null;
  onClose: () => void;
}) {
  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token.rawToken);
    toast.success('Token copied');
  };
  return (
    <Dialog fullWidth maxWidth="sm" open={Boolean(token)} onClose={onClose}>
      <DialogTitle>Save this token now</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2 }}>
        <Alert severity="warning">This is the only time My Kanban displays the raw token.</Alert>
        <TextField
          fullWidth
          multiline
          value={token?.rawToken ?? ''}
          slotProps={{
            input: {
              readOnly: true,
              endAdornment: (
                <IconButton onClick={copy}>
                  <Iconify icon="solar:copy-bold" />
                </IconButton>
              ),
            },
          }}
        />
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            borderRadius: 1.5,
            color: 'text.secondary',
            bgcolor: 'background.neutral',
            whiteSpace: 'pre-wrap',
          }}
        >
          kanban project add{' '}
          {token?.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project'} --url
          http://localhost:8083/mcp
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          I saved the token
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LoadingTable() {
  return (
    <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  );
}

function EmptyRow({ message, colSpan = 6 }: { message: string; colSpan?: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ py: 8, color: 'text.secondary' }}>
        {message}
      </TableCell>
    </TableRow>
  );
}
