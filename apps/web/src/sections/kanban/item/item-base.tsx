import type { IKanbanTask } from 'src/types/kanban';
import type { Transform } from '@dnd-kit/utilities';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';

import { memo, useEffect } from 'react';
import { varAlpha, mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { Iconify } from 'src/components/iconify';

import { kanbanClasses } from '../classes';

// ----------------------------------------------------------------------

export type ItemBaseProps = React.ComponentProps<typeof ItemRoot> & {
  ref?: (node: HTMLElement | null) => void;
  task: IKanbanTask;
  open?: boolean;
  onMovePrevious?: () => void;
  onMoveNext?: () => void;
  stateProps?: {
    fadeIn?: boolean;
    sorting?: boolean;
    disabled?: boolean;
    dragging?: boolean;
    dragOverlay?: boolean;
    transition?: string | null;
    transform?: Transform | null;
    listeners?: DraggableSyntheticListeners;
  };
};

function ItemBase({
  task,
  open,
  stateProps,
  ref,
  sx,
  onMovePrevious,
  onMoveNext,
  ...other
}: ItemBaseProps) {
  const { fadeIn, sorting, disabled, dragging, dragOverlay, transition, transform, listeners } =
    stateProps ?? {};
  const { onClick, onKeyDown, ...itemProps } = other;

  useEffect(() => {
    if (!dragOverlay) {
      return;
    }

    document.body.style.cursor = 'grabbing';

    // eslint-disable-next-line consistent-return
    return () => {
      document.body.style.cursor = '';
    };
  }, [dragOverlay]);

  const renderPriority = () => (
    <Chip
      size="small"
      variant="soft"
      label={task.priority}
      aria-label={`Priority ${task.priority}`}
      color={
        (['urgent', 'high'].includes(task.priority) && 'error') ||
        (task.priority === 'medium' && 'warning') ||
        (task.priority === 'low' && 'info') ||
        'default'
      }
      sx={{
        top: 6,
        right: 6,
        position: 'absolute',
        textTransform: 'capitalize',
        ...(task.priority === 'medium' && {
          color: 'warning.darker',
          bgcolor: 'warning.lighter',
        }),
      }}
    />
  );

  const renderImage = () =>
    !!task?.attachments?.length && (
      <Box sx={[(theme) => ({ p: theme.spacing(1, 1, 0, 1) })]}>
        <ItemImage open={open} alt={task?.attachments?.[0]} src={task?.attachments?.[0]} />
      </Box>
    );

  const renderInfo = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          typography: 'caption',
          color: 'text.disabled',
        }}
      >
        {task.storyPoints !== null && (
          <Box
            component="span"
            aria-label={`${task.storyPoints} story points`}
            sx={{
              mr: 1,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              color: 'primary.dark',
              bgcolor: 'primary.lighter',
              fontWeight: 'fontWeightSemiBold',
            }}
          >
            {task.storyPoints} pts
          </Box>
        )}

        {!!task.checklist?.length && (
          <Box
            component="span"
            aria-label={`${task.checklistIncompleteCount ?? 0} checklist items left`}
            sx={{ mr: 1, color: 'text.secondary' }}
          >
            <Iconify width={16} icon="solar:list-bold" sx={{ mr: 0.25 }} />
            {task.checklist.length - (task.checklistIncompleteCount ?? 0)}/{task.checklist.length}
          </Box>
        )}

        {task.dueDate && (
          <Box component="span" aria-label={`Due ${task.dueDate.slice(0, 10)}`} sx={{ mr: 1 }}>
            <Iconify width={16} icon="solar:calendar-date-bold" sx={{ mr: 0.25 }} />
            {task.dueDate.slice(0, 10)}
          </Box>
        )}

        {!!task?.comments?.length && (
          <>
            <Iconify width={16} icon="solar:chat-round-dots-bold" sx={{ mr: 0.25 }} />
            <Box component="span" sx={{ mr: 1 }}>
              {task?.comments?.length}
            </Box>
          </>
        )}

        {!!task?.attachments?.length && (
          <>
            <Iconify width={16} icon="eva:attach-2-fill" sx={{ mr: 0.25 }} />
            <Box component="span">{task?.attachments?.length}</Box>
          </>
        )}
      </Box>

      <AvatarGroup sx={{ [`& .${avatarGroupClasses.avatar}`]: { width: 24, height: 24 } }}>
        {task?.assignee?.map((user) => (
          <Avatar key={user.id} alt={user.name} src={user.avatarUrl} />
        ))}
      </AvatarGroup>
    </Box>
  );

  const renderMoveActions = () =>
    (onMovePrevious || onMoveNext) && (
      <MoveActions role="group" aria-label="Move task between columns">
        <IconButton
          size="small"
          disabled={!onMovePrevious}
          aria-label="Move task to previous column"
          onClick={onMovePrevious}
        >
          <Iconify width={16} icon="eva:arrow-ios-back-fill" />
        </IconButton>
        <IconButton
          size="small"
          disabled={!onMoveNext}
          aria-label="Move task to next column"
          onClick={onMoveNext}
        >
          <Iconify width={16} icon="eva:arrow-ios-forward-fill" />
        </IconButton>
      </MoveActions>
    );

  const renderMetadata = () => (
    <Box sx={{ gap: 0.5, display: 'flex', flexWrap: 'wrap', mt: 1 }}>
      <Chip
        size="small"
        variant="soft"
        color={task.type === 'bug' ? 'error' : 'default'}
        label={task.type}
      />
      {task.isBlocked && <Chip size="small" variant="soft" color="error" label="Blocked" />}
      {task.labels.slice(0, 2).map((label) => (
        <Chip key={label} size="small" variant="outlined" label={label} />
      ))}
      {task.labels.length > 2 && (
        <Chip size="small" variant="outlined" label={`+${task.labels.length - 2}`} />
      )}
    </Box>
  );

  return (
    <ItemWrap
      ref={ref}
      className={mergeClasses([kanbanClasses.itemWrap], {
        [kanbanClasses.state.fadeIn]: fadeIn,
        [kanbanClasses.state.dragOverlay]: dragOverlay,
      })}
      style={{
        ...(!!transition && { transition }),
        ...(!!transform && {
          '--translate-x': `${Math.round(transform.x)}px`,
          '--translate-y': `${Math.round(transform.y)}px`,
          '--scale-x': `${transform.scaleX}`,
          '--scale-y': `${transform.scaleY}`,
        }),
      }}
    >
      <ItemRoot
        className={mergeClasses([kanbanClasses.item], {
          [kanbanClasses.state.sorting]: sorting,
          [kanbanClasses.state.dragging]: dragging,
          [kanbanClasses.state.disabled]: disabled,
          [kanbanClasses.state.dragOverlay]: dragOverlay,
        })}
        data-cypress="draggable-item"
        role="button"
        aria-label={`Open task ${task.name}`}
        tabIndex={0}
        sx={sx}
        {...listeners}
        {...itemProps}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
            return;
          }
          listeners?.onKeyDown?.(event);
          onKeyDown?.(event);
        }}
      >
        {renderImage()}

        <ItemContent>
          {renderPriority()}
          {task.name}
          {renderMetadata()}
          {renderInfo()}
        </ItemContent>
      </ItemRoot>
      {renderMoveActions()}
    </ItemWrap>
  );
}

export default memo(ItemBase);

// ----------------------------------------------------------------------

const ItemWrap = styled('li')(() => ({
  '@keyframes fadeIn': {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 },
  },
  display: 'flex',
  position: 'relative',
  transform:
    'translate3d(var(--translate-x, 0), var(--translate-y, 0), 0) scaleX(var(--scale-x, 1)) scaleY(var(--scale-y, 1))',
  transformOrigin: '0 0',
  touchAction: 'manipulation',
  [`&.${kanbanClasses.state.fadeIn}`]: {
    animation: 'fadeIn 500ms ease',
  },
  [`&.${kanbanClasses.state.dragOverlay}`]: {
    zIndex: 999,
  },
}));

const MoveActions = styled('div')(({ theme }) => ({
  right: 8,
  bottom: 8,
  zIndex: 1,
  display: 'flex',
  position: 'absolute',
  borderRadius: 8,
  backgroundColor: theme.vars.palette.background.paper,
  boxShadow: theme.vars.customShadows.z1,
  [`& .MuiIconButton-root`]: {
    minWidth: 44,
    minHeight: 44,
    [theme.breakpoints.up('sm')]: {
      minWidth: 26,
      minHeight: 26,
    },
  },
}));

const ItemRoot = styled('div')(({ theme }) => ({
  width: '100%',
  cursor: 'grab',
  outline: 'none',
  overflow: 'hidden',
  position: 'relative',
  '&:focus-visible': {
    outline: `3px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
  transformOrigin: '50% 50%',
  touchAction: 'manipulation',
  borderRadius: 'var(--item-radius)',
  WebkitTapHighlightColor: 'transparent',
  boxShadow: theme.vars.customShadows.z1,
  backgroundColor: theme.vars.palette.common.white,
  transition: theme.transitions.create(['box-shadow']),
  ...theme.applyStyles('dark', {
    backgroundColor: theme.vars.palette.grey[900],
  }),
  [`&.${kanbanClasses.state.disabled}`]: {},
  [`&.${kanbanClasses.state.sorting}`]: {},
  // When move item overlay
  [`&.${kanbanClasses.state.dragOverlay}`]: {
    backdropFilter: 'blur(6px)',
    boxShadow: theme.vars.customShadows.z20,
    backgroundColor: varAlpha(theme.vars.palette.common.whiteChannel, 0.48),
    ...theme.applyStyles('dark', {
      backgroundColor: varAlpha(theme.vars.palette.grey['900Channel'], 0.48),
    }),
  },
  // Placeholder when dragging item
  [`&.${kanbanClasses.state.dragging}`]: {
    opacity: 0.2,
    filter: 'grayscale(1)',
  },
}));

const ItemContent = styled('div')(({ theme }) => ({
  ...theme.typography.subtitle2,
  position: 'relative',
  padding: theme.spacing(2.5, 2),
}));

const ItemImage = styled('img', {
  shouldForwardProp: (prop: string) => !['open', 'sx'].includes(prop),
})<Pick<ItemBaseProps, 'open'>>(({ theme }) => ({
  width: 320,
  height: 'auto',
  aspectRatio: '4/3',
  objectFit: 'cover',
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  variants: [
    {
      props: { open: true },
      style: {
        opacity: 0.8,
      },
    },
  ],
}));
