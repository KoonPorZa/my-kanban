import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum McpTokenClientType {
  codex = 'codex',
  claude = 'claude',
  other = 'other',
}

export class CreateMcpTokenDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label!: string;

  @ApiProperty({ enum: McpTokenClientType })
  @IsEnum(McpTokenClientType)
  clientType!: McpTokenClientType;
}

export class McpTokenResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty()
  projectName!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: McpTokenClientType })
  clientType!: McpTokenClientType;

  @ApiProperty()
  tokenPrefix!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  lastUsedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  revokedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CreatedMcpTokenResponseDto extends McpTokenResponseDto {
  @ApiProperty({ description: 'Shown once. The API never returns this value again.' })
  rawToken!: string;
}

export class McpAuditEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  projectId!: string;

  @ApiProperty({ format: 'uuid' })
  tokenId!: string;

  @ApiProperty()
  tokenLabel!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  issueId!: string | null;

  @ApiProperty()
  toolName!: string;

  @ApiProperty()
  requestId!: string;

  @ApiProperty({ enum: ['success', 'rejected', 'failed'] })
  outcome!: 'success' | 'rejected' | 'failed';

  @ApiProperty({ type: [String] })
  changedFields!: string[];

  @ApiProperty({ nullable: true, type: String })
  errorCode!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
