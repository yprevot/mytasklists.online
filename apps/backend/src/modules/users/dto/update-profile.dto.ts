import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ana Lopez' })
  @IsOptional()
  @IsString()
  @Length(3, 160)
  fullName?: string;

  @ApiPropertyOptional({ example: '+5215512345678' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,20}$/, { message: 'El numero de WhatsApp no es valido' })
  whatsapp?: string;

  @ApiPropertyOptional({ description: 'Recibir avisos cuando alguien edita una lista compartida' })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'El avatar debe ser una URL https' })
  @MaxLength(500)
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contrasena no puede superar 128 caracteres' })
  newPassword: string;
}
