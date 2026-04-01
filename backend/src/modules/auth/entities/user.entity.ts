import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'passwordHash' })
  passwordHash!: string;

  @Column({ type: 'datetime', nullable: true, name: 'lastLoginAt' })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;

  private tempPassword?: string;

  @BeforeInsert()
  async hashPasswordOnInsert(): Promise<void> {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }

  @BeforeUpdate()
  async hashPasswordOnUpdate(): Promise<void> {
    if (this.tempPassword) {
      this.passwordHash = await bcrypt.hash(this.tempPassword, 12);
      this.tempPassword = undefined;
    }
  }

  setPassword(plainPassword: string): void {
    this.tempPassword = plainPassword;
    this.passwordHash = plainPassword;
  }

  async comparePassword(candidate: string): Promise<boolean> {
    return bcrypt.compare(candidate, this.passwordHash);
  }

  toSafeJSON(): Record<string, unknown> {
    const { passwordHash: _, tempPassword: _t, ...safe } = this as Record<string, unknown>;
    return safe;
  }
}
