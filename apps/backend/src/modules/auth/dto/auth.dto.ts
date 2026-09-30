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
  MinLength,
} from 'class-validator';
import { DevicePlatform } from '../../../database/entities';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Lopez Garcia', description: 'Nombre completo' })
  @IsString()
  @Length(3, 160, { message: 'El nombre completo debe tener entre 3 y 160 caracteres' })
  fullName: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electronico no es valido' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email: string;

  @ApiProperty({ example: '+5215512345678', description: 'Numero de WhatsApp' })
  @Matches(/^\+?[0-9]{8,20}$/, { message: 'El numero de WhatsApp no es valido' })
  whatsapp: string;

  @ApiProperty({ example: 'SuperSecreta123' })
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail({}, { message: 'El correo electronico no es valido' })
  @Transform(({ value }) => String(value ?? '').trim().toLowerCase())
  email: string;

  @ApiProperty({ example: 'SuperSecreta123' })
  @IsString()
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class SocialTokenDto {
  @ApiProperty({ description: 'id_token de Google o identityToken de Apple' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({ description: 'Nombre completo (Apple solo lo envia la primera vez)' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'WhatsApp para completar el registro social' })
  @IsOptional()
  @Matches(/^\+?[0-9]{8,20}$/)
  whatsapp?: string;
}

export class RegisterDeviceDto {
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
