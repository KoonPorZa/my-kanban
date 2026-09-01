import type { UniqueIdentifier } from '@dnd-kit/core';

import type { IDateValue } from './common';

// ----------------------------------------------------------------------

export type IKanbanComment = {
  id: string;
  name: string;
  message: string;
  avatarUrl: string;
  createdAt: IDateValue;
  messageType: 'image' | 'text';
};

export type IKanbanAssignee = {
  id: string;
  name: string;
  role: string;
  email: string;
  status: string;
  address: string;
  avatarUrl: string;
  phoneNumber: string;
  lastActivity: IDateValue;
};

export type IKanbanTask = {
  name: string;
  status: string;
  type: 'task' | 'story' | 'bug' | 'chore';
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  labels: string[];
  id: UniqueIdentifier;
  version: number;
  sprintId: string | null;
  storyPoints: number | null;
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  checklist?: { id: string; title: string; isCompleted: boolean }[];
  checklistIncompleteCount?: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  attachments: string[];
  comments: IKanbanComment[];
  assignee: IKanbanAssignee[];
  due: [IDateValue, IDateValue];
  reporter: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

export type IKanbanColumn = {
  name: string;
  id: UniqueIdentifier;
  projectId: string;
  version: number;
  category: 'todo' | 'in_progress' | 'done';
  wipLimit: number | null;
};

export type IKanban = {
  projectId: string;
  projectName: string;
  columns: IKanbanColumn[];
  tasks: Record<UniqueIdentifier, IKanbanTask[]>;
  skippedIssueCount: number;
};
