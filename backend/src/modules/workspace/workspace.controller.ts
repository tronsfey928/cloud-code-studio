import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces';

@ApiTags('workspaces')
@Controller('api/workspaces')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const workspace = await this.workspaceService.create(user.userId, dto);
    return { workspace };
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces' })
  @ApiResponse({ status: 200, description: 'List of workspaces' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const workspaces = await this.workspaceService.findAll(user.userId);
    return { workspaces };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace by ID' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const workspace = await this.workspaceService.findOne(id, user.userId);
    return { workspace };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiResponse({ status: 200, description: 'Workspace deleted' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.workspaceService.remove(id, user.userId);
    return { message: 'Workspace deleted' };
  }
}
