import { IsString, IsOptional, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'my-project', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'https://github.com/user/repo.git' })
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https?:\/\/|git@|ssh:\/\/)/, { message: 'Invalid repository URL format' })
  repositoryUrl!: string;

  @ApiPropertyOptional({ example: 'main', default: 'main' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9._\-/]+$/, { message: 'Invalid branch name' })
  branch?: string = 'main';
}
