import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OpenCodeConfigService } from './opencode-config.service';
import { UpdateOpenCodeConfigDto } from './dto/update-opencode-config.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('opencode')
@Controller('api/opencode')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OpenCodeController {
  constructor(private readonly openCodeConfigService: OpenCodeConfigService) {}

  @Get(':workspaceId/config')
  @ApiOperation({ summary: 'Get OpenCode config for a workspace' })
  @ApiResponse({ status: 200, description: 'OpenCode configuration' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async getConfig(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const config = await this.openCodeConfigService.getConfig(workspaceId, user.userId);
    return { config };
  }

  @Put(':workspaceId/config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update OpenCode config for a workspace' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async updateConfig(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOpenCodeConfigDto,
  ) {
    const config = await this.openCodeConfigService.updateConfig(workspaceId, user.userId, dto);
    return { config };
  }
}
