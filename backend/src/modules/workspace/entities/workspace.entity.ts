import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type WorkspaceStatus = 'creating' | 'ready' | 'error';

@Entity('workspaces')
@Index(['userId', 'name'], { unique: true })
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'userId' })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 2048, name: 'repositoryUrl' })
  repositoryUrl!: string;

  @Column({ type: 'varchar', length: 255, default: 'main' })
  branch!: string;

  @Column({ type: 'varchar', length: 1024, nullable: true, name: 'workspacePath' })
  workspacePath!: string | null;

  @Column({ type: 'enum', enum: ['creating', 'ready', 'error'], default: 'creating' })
  status!: WorkspaceStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', name: 'lastAccessedAt' })
  lastAccessedAt!: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
