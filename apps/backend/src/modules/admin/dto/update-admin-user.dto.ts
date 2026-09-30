import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ description: 'Activa (true) o desactiva (false) la cuenta' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Quita la verificacion en dos pasos (dispositivo perdido)' })
  @IsOptional()
  @IsBoolean()
  resetMfa?: boolean;
}
