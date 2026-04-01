import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_MESSAGE_LENGTH } from '../../../common/constants';

export class SendMessageDto {
  @ApiProperty({ maxLength: MAX_MESSAGE_LENGTH })
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  content!: string;
}
