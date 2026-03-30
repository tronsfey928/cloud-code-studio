import path from 'path';
import { containerManager } from './containerService';
import { FileRecord } from '../models/FileRecord';
import { logger } from '../utils/logger';
import { FileTreeNode, FileContent, FileUploadResult } from '../types';
import mongoose from 'mongoose';

export class FileService {
  async uploadFile(
    sessionId: string,
    workspaceId: string,
    containerId: string,
    file: Express.Multer.File,
    targetPath: string
  ): Promise<FileUploadResult> {
    logger.info('Uploading file to container', {
      sessionId,
      workspaceId,
      filename: file.originalname,
    });

    const sanitizedPath = this.sanitizePath(targetPath);
    const fullPath = path.posix.join('/workspace', sanitizedPath, file.originalname);

    // Write file content to container via base64
    const base64Content = file.buffer.toString('base64');
    const mkdirResult = await containerManager.exec(containerId, [
      'mkdir',
      '-p',
      path.posix.dirname(fullPath),
    ]);

    if (mkdirResult.exitCode !== 0) {
      throw new Error(`Failed to create directory: ${mkdirResult.stderr}`);
    }

    const writeResult = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      `echo '${base64Content}' | base64 -d > '${fullPath}'`,
    ]);

    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to write file: ${writeResult.stderr}`);
    }

    const result: FileUploadResult = {
      path: fullPath,
      size: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };

    await FileRecord.create({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      workspaceId: new mongoose.Types.ObjectId(workspaceId),
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
    containerId: string,
    dirPath = '/workspace',
    depth = 3
  ): Promise<FileTreeNode[]> {
    logger.info('Getting file tree', { containerId, dirPath });

    const sanitizedPath = this.sanitizePath(dirPath);
    const result = await containerManager.exec(containerId, [
      'find',
      sanitizedPath,
      '-maxdepth',
      String(depth),
      '-not',
      '-path',
      '*/\\.*',
      '-print',
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list files: ${result.stderr}`);
    }

    const lines = result.stdout.split('\n').filter(Boolean);
    return this.buildFileTree(lines, sanitizedPath);
  }

  async readFile(containerId: string, filePath: string): Promise<FileContent> {
    const sanitizedPath = this.sanitizePath(filePath);
    logger.info('Reading file', { containerId, filePath: sanitizedPath });

    const result = await containerManager.exec(containerId, [
      'cat',
      sanitizedPath,
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to read file: ${result.stderr}`);
    }

    return {
      path: sanitizedPath,
      content: result.stdout,
      encoding: 'utf8',
    };
  }

  async writeFile(
    containerId: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const sanitizedPath = this.sanitizePath(filePath);
    logger.info('Writing file', { containerId, filePath: sanitizedPath });

    const base64Content = Buffer.from(content).toString('base64');
    const result = await containerManager.exec(containerId, [
      '/bin/bash',
      '-c',
      `echo '${base64Content}' | base64 -d > '${sanitizedPath}'`,
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to write file: ${result.stderr}`);
    }
  }

  private buildFileTree(paths: string[], basePath: string): FileTreeNode[] {
    const nodeMap = new Map<string, FileTreeNode>();
    const roots: FileTreeNode[] = [];

    for (const filePath of paths) {
      if (filePath === basePath) continue;
      const name = path.posix.basename(filePath);
      const node: FileTreeNode = {
        name,
        path: filePath,
        type: 'directory',
        children: [],
      };
      nodeMap.set(filePath, node);
    }

    for (const [filePath, node] of nodeMap) {
      const parentPath = path.posix.dirname(filePath);
      const parent = nodeMap.get(parentPath);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else if (parentPath === basePath || filePath.startsWith(basePath)) {
        roots.push(node);
      }
    }

    return roots;
  }

  private sanitizePath(inputPath: string): string {
    const resolved = path.posix.normalize(inputPath);
    if (resolved.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }
}

export const fileService = new FileService();
