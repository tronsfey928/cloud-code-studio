import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { OpenCodeController } from './opencode.controller';
import { OpenCodeService } from './opencode.service';
import { ClaudeCodeService } from './claude-code.service';
import { CodexService } from './codex.service';
import { CopilotCliService } from './copilot-cli.service';
import { CodingServiceFactory } from './coding-service.factory';
import { OpenCodeConfigService } from './opencode-config.service';
import { CacheService } from './cache.service';
import { OpenCodeConfig } from './entities/opencode-config.entity';
import { Workspace } from '../workspace/entities/workspace.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpenCodeConfig, Workspace]),
    ConfigModule,
  ],
  controllers: [OpenCodeController],
  providers: [
    OpenCodeService,
    ClaudeCodeService,
    CodexService,
    CopilotCliService,
    CodingServiceFactory,
    OpenCodeConfigService,
    CacheService,
  ],
  exports: [
    OpenCodeService,
    ClaudeCodeService,
    CodexService,
    CopilotCliService,
    CodingServiceFactory,
    CacheService,
  ],
})
export class OpenCodeModule {}
