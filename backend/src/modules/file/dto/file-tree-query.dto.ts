import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FileTreeQueryDto {
  @ApiPropertyOptional({ default: '.' })
  @IsOptional()
  @IsString()
  path?: string = '.';

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  depth?: number = 3;
}
