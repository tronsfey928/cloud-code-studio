import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { FileRecord } from './entities/file-record.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { FileTreeNode, FileContent, FileUploadResult } from '../../common/interfaces';
import { isValidRelativePath } from '../../common/validation';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(FileRecord)
    private readonly fileRecordRepository: Repository<FileRecord>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  async resolveWorkspace(workspaceId: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (!workspace.workspacePath) throw new BadRequestException('Workspace is not ready');
    return workspace;
  }

  async getFileTree(workspacePath: string, dirPath: string = '.', depth: number = 3): Promise<FileTreeNode[]> {
    const sanitizedPath = this.sanitizePath(dirPath);
    const basePath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(basePath, workspacePath);
    return this.buildFileTreeFromFs(basePath, depth);
  }

  async readFile(workspacePath: string, filePath: string): Promise<FileContent> {
    const sanitizedPath = this.sanitizePath(filePath);
    const fullPath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(fullPath, workspacePath);

    const stat = await fs.stat(fullPath);
    const MAX_READ_SIZE = 10 * 1024 * 1024; // 10 MB — consistent with upload limit
    if (stat.size > MAX_READ_SIZE) {
      throw new BadRequestException('File too large to read (max 10 MB)');
    }

    const content = await fs.readFile(fullPath, 'utf8');
    return { path: sanitizedPath, content, encoding: 'utf8' };
  }

  async writeFile(workspacePath: string, filePath: string, content: string): Promise<void> {
    const sanitizedPath = this.sanitizePath(filePath);
    const fullPath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(fullPath, workspacePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  async uploadFile(
    sessionId: string,
    workspaceId: string,
    workspacePath: string,
    file: Express.Multer.File,
    targetPath: string,
  ): Promise<FileUploadResult> {
    const sanitizedPath = this.sanitizePath(targetPath);
    const fullPath = path.join(workspacePath, sanitizedPath, file.originalname);
    this.assertWithinWorkspace(fullPath, workspacePath);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.buffer);

    const result: FileUploadResult = {
      path: fullPath,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };

    await this.fileRecordRepository.save(
      this.fileRecordRepository.create({
        sessionId,
        workspaceId,
        filename: file.originalname,
        path: fullPath,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: result.uploadedAt,
        storageUrl: fullPath,
      }),
    );

    return result;
  }

  private async buildFileTreeFromFs(basePath: string, depth: number, currentDepth: number = 0): Promise<FileTreeNode[]> {
    if (currentDepth >= depth) return [];

    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(basePath, entry.name);
      const node: FileTreeNode = {
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'directory' : 'file',
      };

      if (entry.isDirectory()) {
        node.children = await this.buildFileTreeFromFs(entryPath, depth, currentDepth + 1);
      }

      nodes.push(node);
    }

    return nodes;
  }

  private sanitizePath(inputPath: string): string {
    const resolved = path.posix.normalize(inputPath);
    if (resolved.includes('..')) {
      throw new BadRequestException('Path traversal detected');
    }
    return resolved;
  }

  private assertWithinWorkspace(targetPath: string, workspacePath: string): void {
    const normalizedTarget = path.resolve(targetPath);
    const normalizedWorkspace = path.resolve(workspacePath);

    if (fsSync.existsSync(normalizedTarget)) {
      const realTarget = fsSync.realpathSync(normalizedTarget);
      const realWorkspace = fsSync.realpathSync(normalizedWorkspace);
      if (!realTarget.startsWith(realWorkspace + path.sep) && realTarget !== realWorkspace) {
        throw new BadRequestException('Path traversal detected');
      }
    } else {
      if (
        !normalizedTarget.startsWith(normalizedWorkspace + path.sep) &&
        normalizedTarget !== normalizedWorkspace
      ) {
        throw new BadRequestException('Path traversal detected');
      }
    }
  }
}
