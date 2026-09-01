import { ApiProperty } from '@nestjs/swagger';

class WorkspaceExportChecklistItemDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() isCompleted!: boolean;
  @ApiProperty({ description: 'Integer rank encoded as a decimal string' }) rank!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class WorkspaceExportColumnDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['todo', 'in_progress', 'done'] })
  category!: 'todo' | 'in_progress' | 'done';
  @ApiProperty({ description: 'Integer rank encoded as a decimal string' }) rank!: string;
  @ApiProperty({ nullable: true, type: Number, minimum: 1 }) wipLimit!: number | null;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) archivedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class WorkspaceExportSprintDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() goal!: string;
  @ApiProperty({ enum: ['planned', 'active', 'completed'] })
  status!: 'planned' | 'active' | 'completed';
  @ApiProperty({ format: 'date' }) startDate!: string;
  @ApiProperty({ format: 'date' }) endDate!: string;
  @ApiProperty({ minimum: 0 }) plannedPoints!: number;
  @ApiProperty({ minimum: 0 }) plannedIssueCount!: number;
  @ApiProperty({ minimum: 0 }) completedPoints!: number;
  @ApiProperty({ minimum: 0 }) completedIssueCount!: number;
  @ApiProperty({ minimum: 0 }) incompletePoints!: number;
  @ApiProperty({ minimum: 0 }) incompleteIssueCount!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) completedAt!: string | null;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class WorkspaceExportIssueDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) sprintId!: string | null;
  @ApiProperty({ format: 'uuid' }) columnId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ enum: ['task', 'story', 'bug', 'chore'] })
  type!: 'task' | 'story' | 'bug' | 'chore';
  @ApiProperty({ enum: ['urgent', 'high', 'medium', 'low', 'none'] })
  priority!: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  @ApiProperty({ type: [String] }) labels!: string[];
  @ApiProperty({ nullable: true, type: Number, minimum: 0, maximum: 100 })
  storyPoints!: number | null;
  @ApiProperty({ description: 'Integer rank encoded as a decimal string' }) rank!: string;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) dueDate!: string | null;
  @ApiProperty() isBlocked!: boolean;
  @ApiProperty({ nullable: true, type: String }) blockedReason!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) archivedAt!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) completedAt!: string | null;
  @ApiProperty({ type: [WorkspaceExportChecklistItemDto] })
  checklist!: WorkspaceExportChecklistItemDto[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

class WorkspaceExportProjectDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() color!: string;
  @ApiProperty({ enum: ['kanban', 'scrum'] }) mode!: 'kanban' | 'scrum';
  @ApiProperty({ enum: [7, 14, 30] }) doneRetentionDays!: number;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) archivedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: [WorkspaceExportColumnDto] }) columns!: WorkspaceExportColumnDto[];
  @ApiProperty({ type: [WorkspaceExportSprintDto] }) sprints!: WorkspaceExportSprintDto[];
  @ApiProperty({ type: [WorkspaceExportIssueDto] }) issues!: WorkspaceExportIssueDto[];
}

class WorkspaceExportWorkspaceDto {
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) activeProjectId!: string;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class WorkspaceExportResponseDto {
  @ApiProperty({ enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ format: 'date-time' }) exportedAt!: string;
  @ApiProperty({ type: WorkspaceExportWorkspaceDto }) workspace!: WorkspaceExportWorkspaceDto;
  @ApiProperty({ type: [WorkspaceExportProjectDto] }) projects!: WorkspaceExportProjectDto[];
}

export class WorkspaceImportResultDto {
  @ApiProperty({ enum: ['replace', 'merge'] }) mode!: 'replace' | 'merge';
  @ApiProperty({ enum: [1] }) schemaVersion!: 1;
  @ApiProperty({ minimum: 0 }) projectCount!: number;
}

class ArchivedProjectCandidateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) archivedAt!: string;
  @ApiProperty({ minimum: 0 }) columnCount!: number;
  @ApiProperty({ minimum: 0 }) issueCount!: number;
  @ApiProperty({ minimum: 0 }) sprintCount!: number;
  @ApiProperty({ minimum: 0 }) mcpTokenCount!: number;
  @ApiProperty({ minimum: 0 }) mcpAuditEventCount!: number;
}

class SprintDeletionCandidateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['planned', 'completed'] }) status!: 'planned' | 'completed';
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty() projectName!: string;
  @ApiProperty({ minimum: 0 }) issueCount!: number;
}

class ArchivedIssueCandidateDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ minimum: 1 }) version!: number;
  @ApiProperty({ format: 'date-time' }) archivedAt!: string;
  @ApiProperty() projectName!: string;
  @ApiProperty({ minimum: 0 }) checklistCount!: number;
}

export class DeletionCandidatesResponseDto {
  @ApiProperty({ type: [ArchivedProjectCandidateDto] }) projects!: ArchivedProjectCandidateDto[];
  @ApiProperty({ type: [SprintDeletionCandidateDto] }) sprints!: SprintDeletionCandidateDto[];
  @ApiProperty({ type: [ArchivedIssueCandidateDto] }) issues!: ArchivedIssueCandidateDto[];
}

export class PermanentlyDeletedProjectDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() deleted!: true;
  @ApiProperty({ minimum: 0 }) columnCount!: number;
  @ApiProperty({ minimum: 0 }) issueCount!: number;
  @ApiProperty({ minimum: 0 }) sprintCount!: number;
  @ApiProperty({ minimum: 0 }) mcpTokenCount!: number;
  @ApiProperty({ minimum: 0 }) mcpAuditEventCount!: number;
}

export class PermanentlyDeletedSprintDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() deleted!: true;
  @ApiProperty({ minimum: 0 }) movedIssueCount!: number;
}

export class PermanentlyDeletedIssueDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() deleted!: true;
  @ApiProperty({ minimum: 0 }) checklistCount!: number;
}
