import type { BoxProps } from '@mui/material/Box';

import { useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';

import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

// ----------------------------------------------------------------------

type Props = BoxProps & {
  liked: boolean;
  taskName: string;
  taskStatus: string;
  onArchive: () => void;
  onLikeToggle: () => void;
  onCloseDetails: () => void;
};

export function KanbanDetailsToolbar({
  sx,
  liked,
  taskName,
  onArchive,
  taskStatus,
  onLikeToggle,
  onCloseDetails,
  ...other
}: Props) {
  const smUp = useMediaQuery((theme) => theme.breakpoints.up('sm'));

  const menuActions = usePopover();
  const confirmDialog = useBoolean();

  const [status, setStatus] = useState(taskStatus);

  const handleChangeStatus = useCallback(
    (newValue: string) => {
      menuActions.onClose();
      setStatus(newValue);
    },
    [menuActions]
  );

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'top-right' } }}
    >
      <MenuList>
        {['To do', 'In progress', 'Ready to test', 'Done'].map((option) => (
          <MenuItem
            key={option}
            selected={status === option}
            onClick={() => handleChangeStatus(option)}
          >
            {option}
          </MenuItem>
        ))}
      </MenuList>
    </CustomPopover>
  );

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
            <IconButton onClick={onCloseDetails} sx={{ mr: 1 }}>
              <Iconify icon="eva:arrow-ios-back-fill" />
            </IconButton>
          </Tooltip>
        )}

        <Button
          size="small"
          variant="soft"
          endIcon={<Iconify icon="eva:arrow-ios-downward-fill" width={16} sx={{ ml: -0.5 }} />}
          onClick={menuActions.onOpen}
        >
          {status}
        </Button>

        <Box component="span" sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex' }}>
          <Tooltip title="Like">
            <IconButton color={liked ? 'default' : 'primary'} onClick={onLikeToggle}>
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
            sx={{ ml: 0.5 }}
          >
            Archive
          </Button>

          <IconButton>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </Box>
      </Box>

      {renderMenuActions()}
      {renderConfirmDialog()}
    </>
  );
}
