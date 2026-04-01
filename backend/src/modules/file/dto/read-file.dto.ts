import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReadFileQueryDto {
  @ApiProperty({ description: 'Relative file path within the workspace' })
  @IsString()
  path!: string;
}
