import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('file_records')
export class FileRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'sessionId' })
  sessionId!: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'workspaceId' })
  workspaceId!: string;

  @Column({ type: 'varchar', length: 255 })
  filename!: string;

  @Column({ type: 'varchar', length: 2048 })
  path!: string;

  @Column({ type: 'int' })
  size!: number;

  @Column({ type: 'varchar', length: 255, name: 'mimeType' })
  mimeType!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', name: 'uploadedAt' })
  uploadedAt!: Date;

  @Column({ type: 'varchar', length: 2048, name: 'storageUrl' })
  storageUrl!: string;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
