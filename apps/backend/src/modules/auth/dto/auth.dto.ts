import type {
  ForgotPasswordRequest,
  LoginRequest,
  MfaCodeRequest,
  MfaVerifyRequest,
  RefreshRequest,
  RegisterDeviceRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SocialTokenRequest,
  VerifyEmailRequest,
} from '@lista/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DevicePlatform } from '../../../database/entities';

export class RegisterDto implements RegisterRequest {
  @ApiProperty({ example: 'Ana López García', description: 'Nombre completo' })
  @IsString()
  @Length(3, 160, { message: 'El nombre completo debe tener entre 3 y 160 caracteres' })
  fullName: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email: string;

  @ApiProperty({ example: '+5215512345678', description: 'Número de WhatsApp' })
  @Matches(/^\+?[0-9]{8,20}$/, { message: 'El número de WhatsApp no es válido' })
  whatsapp: string;

  @ApiProperty({ example: 'SuperSecreta123' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres' })
  password: string;
}

export class LoginDto implements LoginRequest {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'SuperSecreta123' })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MaxLength(128)
  password: string;
}

export class RefreshDto implements RefreshRequest {
  @ApiPropertyOptional({
    description: 'Obligatorio salvo en los clientes web, que lo envían en una cookie httpOnly',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}

export class VerifyEmailDto implements VerifyEmailRequest {
  @ApiProperty({ description: 'Token recibido en el enlace del correo' })
  @IsString()
  @Length(20, 200)
  token: string;
}

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email: string;
}

export class ResetPasswordDto implements ResetPasswordRequest {
  @ApiProperty({ description: 'Token recibido en el enlace del correo' })
  @IsString()
  @Length(20, 200)
  token: string;

  @ApiProperty({ example: 'ClaveNueva12345' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres' })
  newPassword: string;
}

export class MfaCodeDto implements MfaCodeRequest {
  @ApiProperty({ description: 'Código de 6 dígitos de la app autenticadora o un código de recuperación' })
  @IsString()
  @Length(6, 20)
  code: string;
}

export class MfaVerifyDto extends MfaCodeDto implements MfaVerifyRequest {
  @ApiProperty({ description: 'Token del reto que devolvió el login' })
  @IsString()
  @Length(20, 200)
  mfaToken: string;
}

export class SocialTokenDto implements SocialTokenRequest {
  @ApiProperty({ description: 'id_token de Google o identityToken de Apple' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ description: 'Nombre completo (Apple solo lo envía la primera vez)' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'WhatsApp para completar el registro social' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,20}$/)
  whatsapp?: string;
}

export class RegisterDeviceDto implements RegisterDeviceRequest {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;
}
