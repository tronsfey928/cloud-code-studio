import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { McpServerConfig } from '../../../common/interfaces';

@Entity('opencode_configs')
export class OpenCodeConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 36, unique: true, name: 'workspaceId' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 50, default: 'opencode', name: 'codingProvider' })
  codingProvider!: string;

  @Column({ type: 'varchar', length: 100, default: 'openai', name: 'llmProvider' })
  llmProvider!: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'llmModel' })
  llmModel!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'llmApiKey' })
  llmApiKey!: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true, name: 'llmBaseUrl' })
  llmBaseUrl!: string | null;

  @Column({ type: 'json', default: () => "'[]'" })
  skills!: string[];

  @Column({ type: 'json', name: 'mcpServers', default: () => "'[]'" })
  mcpServers!: McpServerConfig[];

  @Column({ type: 'json', name: 'setupCommands', default: () => "'[]'" })
  setupCommands!: string[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
