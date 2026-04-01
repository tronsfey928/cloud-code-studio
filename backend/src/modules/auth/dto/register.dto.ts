import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'johndoe', minLength: 2, maxLength: 50 })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  username!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'Password123',
    description: 'Must be 8–128 chars with uppercase, lowercase, and digit',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must include uppercase, lowercase, and a digit',
  })
  password!: string;
}
