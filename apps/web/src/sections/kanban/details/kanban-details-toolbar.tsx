import type { BoxProps } from '@mui/material/Box';

import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  liked: boolean;
  taskName: string;
  onArchive: () => void;
  onDuplicate: () => void;
  onMovePrevious?: () => void;
  onMoveNext?: () => void;
  onMoveToBacklog?: () => void;
  onLikeToggle: () => void;
  onCloseDetails: () => void;
};

export function KanbanDetailsToolbar({
  sx,
  liked,
  taskName,
  onArchive,
  onDuplicate,
  onMovePrevious,
  onMoveNext,
  onMoveToBacklog,
  onLikeToggle,
  onCloseDetails,
  ...other
}: Props) {
  const smUp = useMediaQuery((theme) => theme.breakpoints.up('sm'));

  const confirmDialog = useBoolean();

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Archive task"
      content={
        <>
          Archive <strong>{taskName}</strong>? The task will be removed from the active board.
        </>
      }
      action={
        <Button variant="contained" color="warning" onClick={onArchive}>
          Archive
        </Button>
      }
    />
  );

  return (
    <>
      <Box
        sx={[
          (theme) => ({
            display: 'flex',
            alignItems: 'center',
            p: theme.spacing(2.5, 1, 2.5, 2.5),
            borderBottom: `solid 1px ${theme.vars.palette.divider}`,
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
        {...other}
      >
        {!smUp && (
          <Tooltip title="Back">
            <IconButton
              aria-label="Back"
              onClick={onCloseDetails}
              sx={{ mr: 1, minWidth: 44, minHeight: 44 }}
            >
              <Iconify icon="eva:arrow-ios-back-fill" />
            </IconButton>
          </Tooltip>
        )}

        <Box component="span" sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex' }}>
          <Tooltip title="Previous column">
            <span>
              <IconButton
                disabled={!onMovePrevious}
                aria-label="Move task to previous column"
                onClick={onMovePrevious}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <Iconify icon="eva:arrow-ios-back-fill" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next column">
            <span>
              <IconButton
                disabled={!onMoveNext}
                aria-label="Move task to next column"
                onClick={onMoveNext}
                sx={{ minWidth: 44, minHeight: 44 }}
              >
                <Iconify icon="eva:arrow-ios-forward-fill" />
              </IconButton>
            </span>
          </Tooltip>
          {onMoveToBacklog && (
            <Button
              size="small"
              color="inherit"
              variant="soft"
              aria-label="Move task to backlog"
              startIcon={<Iconify icon="solar:inbox-in-bold" />}
              onClick={onMoveToBacklog}
              sx={{ minHeight: 44 }}
            >
              Backlog
            </Button>
          )}

          <Tooltip title="Duplicate task">
            <IconButton
              aria-label="Duplicate task"
              onClick={onDuplicate}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Iconify icon="solar:copy-bold" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Like">
            <IconButton
              aria-label="Like task"
              color={liked ? 'default' : 'primary'}
              onClick={onLikeToggle}
              sx={{ minWidth: 44, minHeight: 44 }}
            >
              <Iconify icon="solar:like-bold" />
            </IconButton>
          </Tooltip>

          <Button
            size="small"
            color="warning"
            variant="soft"
            aria-label="Archive task"
            startIcon={<Iconify icon="solar:archive-down-minimlistic-bold" />}
            onClick={confirmDialog.onTrue}
            sx={{ ml: 0.5, minHeight: 44 }}
          >
            Archive
          </Button>
        </Box>
      </Box>

      {renderConfirmDialog()}
    </>
  );
}
