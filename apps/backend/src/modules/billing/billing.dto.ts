import { IsString, IsOptional, IsInt, Min, Max, Matches, IsIn, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
export class PromotionDto {
  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_-]{1,64}$/) code?:string;
  @IsOptional() @IsInt() @Min(0) @Max(500) expectedTotal?:number;
}
export class CreatePromotionDto {
  @Transform(({value})=>typeof value==='string'?value.trim().toUpperCase():value)
  @IsString() @Matches(/^[A-Z0-9_-]{1,64}$/) code:string;
  @IsOptional() @IsInt() @Min(1) @Max(100) percent?:number;
  @IsOptional() @IsInt() @Min(1) @Max(500) amount?:number;
  @IsOptional() @IsDateString() expiresAt?:string;
  @IsInt() @Min(1) @Max(36) months:number;
  @IsInt() @Min(1) @Max(100000) maxUses:number;
}
export class StorePurchaseDto {
  @IsIn(['apple','google']) provider:'apple'|'google';
  @IsString() @Matches(/^[A-Za-z0-9._-]{1,200}$/) productId:string;
  @IsString() @Matches(/^[A-Za-z0-9._~-]{1,20000}$/) token:string;
}
