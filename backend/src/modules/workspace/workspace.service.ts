import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Workspace } from './entities/workspace.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { GitService } from './git.service';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    private readonly configService: ConfigService,
    private readonly gitService: GitService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const workspace = this.workspaceRepository.create({
      userId,
      name: dto.name,
      repositoryUrl: dto.repositoryUrl,
      branch: dto.branch || 'main',
      status: 'creating',
    });
    await this.workspaceRepository.save(workspace);

    const workspacesDir = this.configService.get<string>('app.workspacesDir', '/data/workspaces');
    const workspacePath = path.join(workspacesDir, workspace.id);

    // Set up workspace directory asynchronously
    setImmediate(() => {
      void (async () => {
        try {
          await fs.mkdir(workspacePath, { recursive: true });
          if (dto.repositoryUrl) {
            await this.gitService.clone(dto.repositoryUrl, dto.branch || 'main', workspacePath);
          }
          await this.workspaceRepository.update(workspace.id, {
            workspacePath,
            status: 'ready',
          });
          this.logger.log(`Workspace ready: ${workspace.id}`);
        } catch (err) {
          await this.workspaceRepository.update(workspace.id, { status: 'error' });
          this.logger.error(`Failed to set up workspace: ${workspace.id}`, (err as Error).stack);
        }
      })();
    });

    return workspace;
  }

  async findAll(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository.find({
      where: { userId },
      order: { lastAccessedAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    workspace.lastAccessedAt = new Date();
    await this.workspaceRepository.save(workspace);
    return workspace;
  }

  async remove(id: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    if (workspace.workspacePath) {
      try {
        await fs.rm(workspace.workspacePath, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn(`Failed to remove workspace directory: ${workspace.id}`, (err as Error).stack);
      }
    }

    await this.workspaceRepository.remove(workspace);
  }
}
