import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class GitService {
  async clone(
    repositoryUrl: string,
    branch: string,
    targetDir: string
  ): Promise<void> {
    logger.info('Cloning repository', { repositoryUrl, branch, targetDir });

    const sanitizedUrl = this.sanitizeGitUrl(repositoryUrl);
    const sanitizedBranch = this.sanitizeBranchName(branch);
    const sanitizedTarget = path.resolve(targetDir);

    const command = `git clone --branch ${sanitizedBranch} --single-branch --depth 1 ${sanitizedUrl} ${sanitizedTarget}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 120_000,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=no',
        },
      });
      logger.info('Repository cloned', { stdout, stderr });
    } catch (error) {
      logger.error('Git clone failed', { repositoryUrl, branch, error });
      throw new Error(`Failed to clone repository: ${(error as Error).message}`);
    }
  }

  async getBranches(repositoryUrl: string): Promise<string[]> {
    logger.info('Fetching branches', { repositoryUrl });
    const sanitizedUrl = this.sanitizeGitUrl(repositoryUrl);

    try {
      const { stdout } = await execAsync(
        `git ls-remote --heads ${sanitizedUrl}`,
        {
          timeout: 30_000,
          env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: '0',
          },
        }
      );

      const branches = stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => line.split('\t')[1]?.replace('refs/heads/', '') ?? '')
        .filter(Boolean);

      return branches;
    } catch (error) {
      logger.error('Failed to list branches', { repositoryUrl, error });
      throw new Error(`Failed to list branches: ${(error as Error).message}`);
    }
  }

  async pull(repoDir: string, branch: string): Promise<void> {
    const sanitizedBranch = this.sanitizeBranchName(branch);
    const sanitizedDir = path.resolve(repoDir);

    try {
      await execAsync(`git -C ${sanitizedDir} pull origin ${sanitizedBranch}`, {
        timeout: 60_000,
      });
    } catch (error) {
      logger.error('Git pull failed', { repoDir, branch, error });
      throw new Error(`Failed to pull: ${(error as Error).message}`);
    }
  }

  private sanitizeGitUrl(url: string): string {
    // Allow only http, https, and ssh git URLs
    if (!/^(https?:\/\/|git@|ssh:\/\/)/.test(url)) {
      throw new Error('Invalid repository URL format');
    }
    // Remove shell-dangerous characters
    return url.replace(/[;&|`$(){}[\]\\'"!]/g, '');
  }

  private sanitizeBranchName(branch: string): string {
    // Branch names: alphanumeric, dash, underscore, dot, forward slash only
    if (!/^[a-zA-Z0-9._\-/]+$/.test(branch)) {
      throw new Error('Invalid branch name');
    }
    return branch;
  }
}

export const gitService = new GitService();
