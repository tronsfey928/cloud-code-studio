import Dockerode from 'dockerode';
import { PassThrough } from 'stream';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ContainerStatus } from '../types';

const docker = new Dockerode();

export class ContainerManager {
  async createAndStart(
    workspaceId: string,
    repositoryUrl: string,
    branch: string,
    resources: { cpu: string; memory: string }
  ): Promise<string> {
    logger.info('Creating container', { workspaceId, repositoryUrl, branch });

    const nanoCpus = Math.floor(parseFloat(resources.cpu) * 1e9);
    const memoryBytes = this.parseMemory(resources.memory);

    const container = await docker.createContainer({
      Image: config.sandboxImage,
      name: `workspace-${workspaceId}`,
      Labels: {
        'cloud-code-studio': 'true',
        workspaceId,
      },
      Env: [
        `REPO_URL=${repositoryUrl}`,
        `REPO_BRANCH=${branch}`,
        `WORKSPACE_ID=${workspaceId}`,
      ],
      Cmd: ['/bin/bash', '-c', 'tail -f /dev/null'],
      WorkingDir: '/workspace',
      HostConfig: {
        NanoCpus: nanoCpus,
        Memory: memoryBytes,
        AutoRemove: false,
        NetworkMode: 'bridge',
      },
      AttachStdout: false,
      AttachStderr: false,
    });

    await container.start();
    logger.info('Container started', { containerId: container.id, workspaceId });
    return container.id;
  }

  async stop(containerId: string): Promise<void> {
    logger.info('Stopping container', { containerId });
    try {
      const container = docker.getContainer(containerId);
      await container.stop({ t: 10 });
      logger.info('Container stopped', { containerId });
    } catch (error) {
      logger.error('Failed to stop container', { containerId, error });
      throw error;
    }
  }

  async destroy(containerId: string): Promise<void> {
    logger.info('Destroying container', { containerId });
    try {
      const container = docker.getContainer(containerId);
      try {
        await container.stop({ t: 5 });
      } catch {
        // Container may already be stopped
      }
      await container.remove({ force: true });
      logger.info('Container destroyed', { containerId });
    } catch (error) {
      logger.error('Failed to destroy container', { containerId, error });
      throw error;
    }
  }

  async getStatus(containerId: string): Promise<ContainerStatus> {
    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      return {
        id: containerId,
        status: info.State.Status,
        running: info.State.Running,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt,
      };
    } catch (error) {
      logger.error('Failed to get container status', { containerId, error });
      throw error;
    }
  }

  async getLogs(containerId: string, tail = 100): Promise<string> {
    try {
      const container = docker.getContainer(containerId);
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logStream.toString('utf8');
    } catch (error) {
      logger.error('Failed to get container logs', { containerId, error });
      throw error;
    }
  }

  async exec(
    containerId: string,
    command: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
    });

    return new Promise((resolve, reject) => {
      exec.start({ hijack: true, stdin: false }, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error('No stream returned'));

        let stdout = '';
        let stderr = '';

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();

        stdoutStream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        stderrStream.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });

        docker.modem.demuxStream(stream, stdoutStream, stderrStream);

        stream.on('end', async () => {
          try {
            const inspect = await exec.inspect();
            resolve({
              stdout,
              stderr,
              exitCode: inspect.ExitCode ?? 0,
            });
          } catch {
            resolve({ stdout, stderr, exitCode: 0 });
          }
        });

        stream.on('error', reject);
      });
    });
  }

  private parseMemory(memory: string): number {
    const unit = memory.slice(-1).toLowerCase();
    const value = parseInt(memory.slice(0, -1), 10);
    const units: Record<string, number> = {
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };
    return value * (units[unit] || 1);
  }
}

export const containerManager = new ContainerManager();
