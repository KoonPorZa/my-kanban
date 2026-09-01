'use client';

import type { BoardResponseDto, IssueResponseDto } from '@my-kanban/api-client';

import { moveIssue, createIssue, getGetBoardQueryKey } from '@my-kanban/api-client';

import { getQueryClient } from 'src/lib/query-client';

export type BacklogOrderIssue = Pick<IssueResponseDto, 'id' | 'version' | 'columnId'>;

export function createBacklogIssue(projectId: string, columnId: string, title: string) {
  return createIssue(projectId, { columnId, title: title.trim() });
}

export async function reorderBacklogIssue(
  projectId: string,
  issue: BacklogOrderIssue,
  orderedBacklogIssues: BacklogOrderIssue[]
) {
  if (orderedBacklogIssues.some((item) => item.columnId !== issue.columnId)) {
    throw new Error('Backlog tasks can only be reordered within their Board column');
  }

  const index = orderedBacklogIssues.findIndex((item) => item.id === issue.id);
  if (index < 0) throw new Error('Moved backlog task is missing from the new order');

  const queryClient = getQueryClient();
  const queryKey = getGetBoardQueryKey(projectId);
  await queryClient.cancelQueries({ queryKey });
  const previous = queryClient.getQueryData<BoardResponseDto>(queryKey);
  const orderedById = new Map(orderedBacklogIssues.map((item) => [item.id, item]));
  const orderedQueue = orderedBacklogIssues.map(({ id }) => id);

  queryClient.setQueryData<BoardResponseDto>(queryKey, (board) => {
    if (!board) return board;
    const issueById = new Map(board.issues.map((item) => [item.id, item]));
    let queueIndex = 0;
    return {
      ...board,
      issues: board.issues.map((item) => {
        if (
          item.sprintId !== null ||
          item.columnId !== issue.columnId ||
          !orderedById.has(item.id)
        ) {
          return item;
        }
        const nextId = orderedQueue[queueIndex++];
        return issueById.get(nextId) ?? item;
      }),
    };
  });

  try {
    const updated = await moveIssue(issue.id, {
      version: issue.version,
      targetColumnId: issue.columnId,
      beforeIssueId: orderedBacklogIssues[index + 1]?.id,
      afterIssueId: orderedBacklogIssues[index - 1]?.id,
    });
    queryClient.setQueryData<BoardResponseDto>(queryKey, (board) =>
      board
        ? {
            ...board,
            issues: board.issues.map((item) => (item.id === updated.id ? updated : item)),
          }
        : board
    );
    return updated;
  } catch (error) {
    if (previous) queryClient.setQueryData(queryKey, previous);
    throw error;
  } finally {
    await queryClient.invalidateQueries({ queryKey });
  }
}
