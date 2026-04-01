import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { FileService } from './file.service';
import { FileTreeQueryDto } from './dto/file-tree-query.dto';
import { WriteFileDto } from './dto/write-file.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces';
import { isValidRelativePath } from '../../common/validation';

@ApiTags('files')
@Controller('api/files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Get(':workspaceId/tree')
  @ApiOperation({ summary: 'Get file tree for a workspace' })
  @ApiResponse({ status: 200, description: 'File tree' })
  async getFileTree(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: FileTreeQueryDto,
  ) {
    const workspace = await this.fileService.resolveWorkspace(workspaceId, user.userId);

    const dirPath = query.path || '.';
    if (dirPath !== '.' && !isValidRelativePath(dirPath)) {
      throw new BadRequestException('Invalid directory path');
    }

    const tree = await this.fileService.getFileTree(workspace.workspacePath!, dirPath, query.depth);
    return { tree };
  }

  @Get(':workspaceId/read')
  @ApiOperation({ summary: 'Read a file from workspace' })
  @ApiResponse({ status: 200, description: 'File content' })
  async readFile(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query('path') filePath: string,
  ) {
    if (!filePath) throw new BadRequestException('path query parameter is required');
    if (!isValidRelativePath(filePath)) throw new BadRequestException('Invalid file path');

    const workspace = await this.fileService.resolveWorkspace(workspaceId, user.userId);
    const file = await this.fileService.readFile(workspace.workspacePath!, filePath);
    return { file };
  }

  @Put(':workspaceId/write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Write a file in workspace' })
  @ApiResponse({ status: 200, description: 'File written successfully' })
  async writeFile(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: WriteFileDto,
  ) {
    if (!isValidRelativePath(dto.path)) throw new BadRequestException('Invalid file path');

    const workspace = await this.fileService.resolveWorkspace(workspaceId, user.userId);
    await this.fileService.writeFile(workspace.workspacePath!, dto.path, dto.content);
    return { message: 'File written successfully' };
  }

  @Post(':workspaceId/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to workspace' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  async uploadFile(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const targetPath = dto.targetPath || '/';
    if (targetPath !== '/' && !isValidRelativePath(targetPath)) {
      throw new BadRequestException('Invalid target path');
    }

    const workspace = await this.fileService.resolveWorkspace(workspaceId, user.userId);
    const result = await this.fileService.uploadFile(
      dto.sessionId,
      workspace.id,
      workspace.workspacePath!,
      file,
      targetPath,
    );
    return { result };
  }
}
