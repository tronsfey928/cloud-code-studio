import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { FileRecord } from '../models/FileRecord';
import { logger } from '../utils/logger';
import { FileTreeNode, FileContent, FileUploadResult } from '../types';

export class FileService {
  async uploadFile(
    sessionId: string,
    workspaceId: string,
    workspacePath: string,
    file: Express.Multer.File,
    targetPath: string
  ): Promise<FileUploadResult> {
    logger.info('Uploading file to workspace', {
      sessionId,
      workspaceId,
      filename: file.originalname,
    });

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

    await FileRecord.create({
      sessionId,
      workspaceId,
      filename: file.originalname,
      path: fullPath,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: result.uploadedAt,
      storageUrl: fullPath,
    });

    return result;
  }

  async getFileTree(
    workspacePath: string,
    dirPath = '.',
    depth = 3
  ): Promise<FileTreeNode[]> {
    logger.info('Getting file tree', { workspacePath, dirPath });

    const sanitizedPath = this.sanitizePath(dirPath);
    const basePath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(basePath, workspacePath);
    return this.buildFileTreeFromFs(basePath, depth);
  }

  async readFile(workspacePath: string, filePath: string): Promise<FileContent> {
    const sanitizedPath = this.sanitizePath(filePath);
    const fullPath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(fullPath, workspacePath);
    logger.info('Reading file', { fullPath });

    const content = await fs.readFile(fullPath, 'utf8');

    return {
      path: sanitizedPath,
      content,
      encoding: 'utf8',
    };
  }

  async writeFile(
    workspacePath: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const sanitizedPath = this.sanitizePath(filePath);
    const fullPath = path.resolve(workspacePath, sanitizedPath);
    this.assertWithinWorkspace(fullPath, workspacePath);
    logger.info('Writing file', { fullPath });

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  private async buildFileTreeFromFs(
    basePath: string,
    depth: number,
    currentDepth = 0
  ): Promise<FileTreeNode[]> {
    if (currentDepth >= depth) return [];

    const entries = await fs.readdir(basePath, { withFileTypes: true });
    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      // Skip hidden files/directories
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
      throw new Error('Path traversal detected');
    }
    return resolved;
  }

  /**
   * Verify that a resolved path stays within the workspace directory.
   * Uses realpath when the path exists to defeat symlink-based escapes.
   */
  private assertWithinWorkspace(targetPath: string, workspacePath: string): void {
    const normalizedTarget = path.resolve(targetPath);
    const normalizedWorkspace = path.resolve(workspacePath);

    // If the file already exists, resolve through symlinks
    if (fsSync.existsSync(normalizedTarget)) {
      const realTarget = fsSync.realpathSync(normalizedTarget);
      const realWorkspace = fsSync.realpathSync(normalizedWorkspace);
      if (!realTarget.startsWith(realWorkspace + path.sep) && realTarget !== realWorkspace) {
        throw new Error('Path traversal detected');
      }
    } else {
      // For new files, verify the resolved path prefix
      if (
        !normalizedTarget.startsWith(normalizedWorkspace + path.sep) &&
        normalizedTarget !== normalizedWorkspace
      ) {
        throw new Error('Path traversal detected');
      }
    }
  }
}

export const fileService = new FileService();
