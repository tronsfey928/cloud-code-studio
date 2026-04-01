import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

  async clone(repositoryUrl: string, branch: string, targetDir: string): Promise<void> {
    this.logger.log(`Cloning repository: ${repositoryUrl} branch: ${branch}`);

    const sanitizedUrl = this.sanitizeGitUrl(repositoryUrl);
    const sanitizedBranch = this.sanitizeBranchName(branch);
    const sanitizedTarget = path.resolve(targetDir);

    const command = `git clone --branch ${this.shellQuote(sanitizedBranch)} --single-branch --depth 1 ${this.shellQuote(sanitizedUrl)} ${this.shellQuote(sanitizedTarget)}`;

    try {
      await execAsync(command, {
        timeout: 120_000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=accept-new',
        },
      });
      this.logger.log('Repository cloned successfully');
    } catch (error) {
      this.logger.error(`Git clone failed: ${(error as Error).message}`);
      throw new Error(`Failed to clone repository: ${(error as Error).message}`);
    }
  }

  async getBranches(repositoryUrl: string): Promise<string[]> {
    const sanitizedUrl = this.sanitizeGitUrl(repositoryUrl);

    try {
      const { stdout } = await execAsync(
        `git ls-remote --heads ${this.shellQuote(sanitizedUrl)}`,
        { timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
      );

      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[1]?.replace('refs/heads/', '') ?? '')
        .filter(Boolean);
    } catch (error) {
      throw new Error(`Failed to list branches: ${(error as Error).message}`);
    }
  }

  async pull(repoDir: string, branch: string): Promise<void> {
    const sanitizedBranch = this.sanitizeBranchName(branch);
    const sanitizedDir = path.resolve(repoDir);

    try {
      await execAsync(
        `git -C ${this.shellQuote(sanitizedDir)} pull origin ${this.shellQuote(sanitizedBranch)}`,
        { timeout: 120_000 },
      );
    } catch (error) {
      throw new Error(`Failed to pull: ${(error as Error).message}`);
    }
  }

  private sanitizeGitUrl(url: string): string {
    if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(url)) {
      throw new Error('Invalid repository URL format');
    }
    return url.replace(/[;&|`$(){}[\]\\'"!]/g, '');
  }

  private sanitizeBranchName(branch: string): string {
    if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
      throw new Error('Invalid branch name');
    }
    return branch;
  }

  private shellQuote(value: string): string {
    return "'" + value.replace(/'/g, "'\\''") + "'";
  }
}
