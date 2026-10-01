import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppPlatform } from '@lista/contracts';
import { REGISTRATION_MIN_VERSION, updateDestination } from '../mobile-rollout';
import { compareVersions, parseVersion } from '../version';
import type { MobileConfig } from '../../config/configuration';

export const APP_UPDATE_REQUIRED = 'APP_UPDATE_REQUIRED';

/**
 * Corta a las apps móviles que ya no son compatibles con la API. Solo mira a quien
 * manda `X-App-Version`: la web y el panel se despliegan junto con el backend y
 * nunca quedan atrás. Se evalúa antes que la autenticación para que una app vieja
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
    const legacyRegistration = String(request.url || '').split('?')[0].replace(/\/$/,'').endsWith('/auth/register');
    const minimumText = legacyRegistration ? REGISTRATION_MIN_VERSION : mobile.minVersion;
    const minimum = parseVersion(minimumText);
    if (!minimum || compareVersions(version, minimum) >= 0) return true;

    const platform = request.headers?.['x-app-platform'] as AppPlatform | undefined;
    const storeUrl = updateDestination(mobile, platform);

    throw new HttpException(
      {
        error: 'UpgradeRequired',
        message: 'Esta versión de la app ya no es compatible. Actualízala para seguir usándola.',
        code: APP_UPDATE_REQUIRED,
        details: { minVersion: minimumText, storeUrl, downloadUrl: mobile.downloadUrl, webUrl: mobile.webUrl },
      },
      426,
    );
  }
}
