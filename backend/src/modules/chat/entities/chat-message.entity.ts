import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MessageType } from '../../../common/interfaces';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 36, name: 'sessionId' })
  sessionId!: string;

  @Column({ type: 'enum', enum: MessageType })
  type!: MessageType;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'bigint' })
  timestamp!: number;

  @Column({ type: 'boolean', default: false, name: 'isStreaming' })
  isStreaming!: boolean;

  @Column({ type: 'enum', enum: ['user', 'assistant', 'system'] })
  role!: 'user' | 'assistant' | 'system';

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
