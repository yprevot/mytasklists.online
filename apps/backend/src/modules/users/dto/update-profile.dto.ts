import type { ChangePasswordRequest, DeleteAccountRequest, Locale, UpdateProfileRequest } from '@lista/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto implements UpdateProfileRequest {
  @ApiPropertyOptional({ example: 'Ana López' })
  @IsOptional()
  @IsString()
  @Length(3, 160)
  fullName?: string;

  @ApiPropertyOptional({ example: '+5215512345678' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,20}$/, { message: 'El número de WhatsApp no es válido' })
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

  @ApiPropertyOptional({ enum: ['es', 'en'], description: 'Idioma de los correos y avisos' })
  @IsOptional()
  @IsIn(['es', 'en'])
  locale?: Locale;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres' })
  newPassword: string;
}

export class DeleteAccountDto implements DeleteAccountRequest {
  @ApiPropertyOptional({ description: 'Obligatoria si la cuenta tiene contraseña' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional({ description: 'Código de 2FA o de recuperación, si la 2FA está activa' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  mfaCode?: string;

  @ApiPropertyOptional({ description: 'authorizationCode nuevo de Sign in with Apple (iOS) para revocar sus tokens' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  appleAuthorizationCode?: string;
}
