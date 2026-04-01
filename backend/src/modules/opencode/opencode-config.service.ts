import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import { Workspace } from '../workspace/entities/workspace.entity';
import { UpdateOpenCodeConfigDto } from './dto/update-opencode-config.dto';

@Injectable()
export class OpenCodeConfigService {
  private readonly logger = new Logger(OpenCodeConfigService.name);

  constructor(
    @InjectRepository(OpenCodeConfig)
    private readonly configRepository: Repository<OpenCodeConfig>,
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  async getConfig(workspaceId: string, userId: string): Promise<Record<string, unknown>> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    let config = await this.configRepository.findOne({
      where: { workspaceId: workspace.id },
    });

    if (!config) {
      config = this.configRepository.create({ workspaceId: workspace.id });
      config = await this.configRepository.save(config);
    }

    return this.toSafeConfig(config);
  }

  async updateConfig(
    workspaceId: string,
    userId: string,
    dto: UpdateOpenCodeConfigDto,
  ): Promise<Record<string, unknown>> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, userId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');

    let config = await this.configRepository.findOne({
      where: { workspaceId: workspace.id },
    });

    const updates: Partial<OpenCodeConfig> = {};
    if (dto.codingProvider !== undefined) updates.codingProvider = dto.codingProvider;
    if (dto.llmProvider !== undefined) updates.llmProvider = dto.llmProvider;
    if (dto.llmModel !== undefined) updates.llmModel = dto.llmModel;
    if (dto.llmApiKey !== undefined) updates.llmApiKey = dto.llmApiKey;
    if (dto.llmBaseUrl !== undefined) updates.llmBaseUrl = dto.llmBaseUrl;
    if (dto.skills !== undefined) updates.skills = dto.skills;
    if (dto.mcpServers !== undefined) updates.mcpServers = dto.mcpServers;
    if (dto.setupCommands !== undefined) updates.setupCommands = dto.setupCommands;

    if (!config) {
      config = this.configRepository.create({
        workspaceId: workspace.id,
        ...updates,
      });
      config = await this.configRepository.save(config);
    } else {
      Object.assign(config, updates);
      config = await this.configRepository.save(config);
    }

    return this.toSafeConfig(config);
  }

  private maskApiKey(key: string | null | undefined): string | null {
    if (!key) return null;
    if (key.length <= 4) return '****';
    return '****' + key.slice(-4);
  }

  private toSafeConfig(config: OpenCodeConfig): Record<string, unknown> {
    const json = { ...config } as Record<string, unknown>;
    json['llmApiKey'] = this.maskApiKey(config.llmApiKey);
    return json;
  }
}
