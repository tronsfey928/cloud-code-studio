import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadFileDto {
  @ApiProperty()
  @IsUUID()
  sessionId!: string;

  @ApiPropertyOptional({ default: '/' })
  @IsOptional()
  @IsString()
  targetPath?: string = '/';
}
