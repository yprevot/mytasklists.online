import type { RegistrationRequest, CompleteRegistrationRequest } from '@lista/contracts';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
export class RegistrationRequestDto implements RegistrationRequest {
  @Transform(({value}) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(180) email: string;
}
export class RegistrationTokenDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token: string;
}
export class CompleteRegistrationDto extends RegistrationTokenDto implements CompleteRegistrationRequest {
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(3,160) fullName: string;
  @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @Matches(/^\+?[0-9]{8,20}$/) whatsapp: string;
  @IsString() @Length(8,128) password: string;
  @IsString() @Length(8,128) passwordConfirmation: string;
}
