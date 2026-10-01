import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(254)
  email: string;

  @ApiPropertyOptional({ example: 'Ana' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
