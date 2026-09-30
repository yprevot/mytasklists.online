import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { localeFromHeader } from '../../i18n/locale';

/** Idioma de la petición según `Accept-Language` */
export const RequestLocale = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  localeFromHeader(context.switchToHttp().getRequest().headers?.['accept-language']),
);
