import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';
import { GitService } from './git.service';
import { Workspace } from './entities/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace]),
    ConfigModule,
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, GitService],
  exports: [WorkspaceService, TypeOrmModule],
})
export class WorkspaceModule {}
