import type { CreateItemRequest, ReorderItemsRequest, UpdateItemRequest } from '@lista/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateItemDto implements CreateItemRequest {
  @ApiProperty({ example: 'Pan de caja' })
  @IsString()
  @Length(1, 140)
  name: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999)
  quantity?: number;

  @ApiPropertyOptional({ example: 'pza' })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 300)
  note?: string;

  @ApiPropertyOptional({ example: 'panaderia' })
  @IsOptional()
  @IsString()
  @Length(1, 40)
  category?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Si es true el producto se vuelve a activar solo cada `recurrenceDays` días',
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 14, minimum: 1, maximum: 365 })
  @ValidateIf((dto: CreateItemDto) => dto.isRecurring === true)
  @Type(() => Number)
  @IsInt({ message: 'Los días de recurrencia deben ser un número entero' })
  @Min(1, { message: 'La recurrencia mínima es de 1 día' })
  @Max(365, { message: 'La recurrencia máxima es de 365 días' })
  recurrenceDays?: number;
}

export class UpdateItemDto implements UpdateItemRequest {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 140)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 300)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 40)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  recurrenceDays?: number | null;
}

export class ReorderItemsDto implements ReorderItemsRequest {
  @ApiProperty({ type: [String], description: 'Ids de los productos en el orden deseado' })
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];
}
