import { RegistrationService } from './registration.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AccountDeletionService } from './account-deletion.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AccountController } from './account.controller';
import { TokenService } from './token.service';
import { OAuthService } from './oauth.service';
import { MfaService } from './mfa.service';
import { AuthCookieService } from './auth-cookie.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessTtl', '15m') as any },
      }),
    }),
  ],
  providers: [RegistrationService, AuthService, TokenService, OAuthService, MfaService, AuthCookieService, AccountDeletionService],
  controllers: [AuthController, AccountController],
  exports: [AuthService, TokenService, MfaService, JwtModule],
})
export class AuthModule {}
