import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_FILE_CONTENT_LENGTH } from '../../../common/constants';

export class WriteFileDto {
  @ApiProperty({ description: 'Relative file path within the workspace' })
  @IsString()
  path!: string;

  @ApiProperty({ description: 'File content' })
  @IsString()
  @MaxLength(MAX_FILE_CONTENT_LENGTH)
  content!: string;
}
