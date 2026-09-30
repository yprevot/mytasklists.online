import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppPlatform } from '@lista/contracts';
import { compareVersions, parseVersion } from '../version';
import type { MobileConfig } from '../../config/configuration';

export const APP_UPDATE_REQUIRED = 'APP_UPDATE_REQUIRED';

/**
 * Corta a las apps moviles que ya no son compatibles con la API. Solo mira a quien
 * manda `X-App-Version`: la web y el panel se despliegan junto con el backend y
 * nunca quedan atras. Se evalua antes que la autenticacion para que una app vieja
 * reciba "actualiza" y no un 401 que la mande al login.
 */
@Injectable()
export class AppVersionGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest();
    const header = request.headers?.['x-app-version'];
    const version = typeof header === 'string' ? parseVersion(header) : null;
    // Sin cabecera o con un valor ilegible no podemos saber si es vieja: se atiende
    if (!version) return true;

    const mobile = this.config.get<MobileConfig>('mobile')!;
    const minimum = parseVersion(mobile.minVersion);
    if (!minimum || compareVersions(version, minimum) >= 0) return true;

    const platform = request.headers?.['x-app-platform'] as AppPlatform | undefined;
    const storeUrl =
      platform === 'ios' ? mobile.storeUrls.ios : platform === 'android' ? mobile.storeUrls.android : null;

    throw new HttpException(
      {
        error: 'UpgradeRequired',
        message: 'Esta version de la app ya no es compatible. Actualizala para seguir usandola.',
        code: APP_UPDATE_REQUIRED,
        details: { minVersion: mobile.minVersion, storeUrl },
      },
      426,
    );
  }
}
