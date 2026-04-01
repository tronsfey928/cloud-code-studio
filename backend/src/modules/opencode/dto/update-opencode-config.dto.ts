import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { McpServerConfig } from '../../../common/interfaces';

export class UpdateOpenCodeConfigDto {
  @ApiPropertyOptional({ example: 'claude_code', description: 'Supported: claude_code, codex, copilot_cli, opencode' })
  @IsOptional()
  @IsString()
  codingProvider?: string;

  @ApiPropertyOptional({ example: 'openai' })
  @IsOptional()
  @IsString()
  llmProvider?: string;

  @ApiPropertyOptional({ example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  llmModel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  llmApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  llmBaseUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  mcpServers?: McpServerConfig[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  setupCommands?: string[];
}
