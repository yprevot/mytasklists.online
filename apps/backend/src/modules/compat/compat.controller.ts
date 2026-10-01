import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppCompatibility } from '@lista/contracts';
import { Public } from '../../common/decorators/public.decorator';
import type { MobileConfig } from '../../config/configuration';

@ApiTags('compatibilidad')
@Controller('app')
export class CompatController {
  constructor(private readonly config: ConfigService) {}

  /**
   * La app lo consulta al abrir. Pasa por AppVersionGuard como cualquier otra ruta,
   * así que una versión vieja recibe 426 aquí mismo, antes de iniciar sesión.
   */
  @Public()
  @Get('compatibility')
  @ApiOperation({ summary: 'Versión mínima de la app móvil que la API sigue atendiendo' })
  compatibility(): AppCompatibility {
    const mobile = this.config.get<MobileConfig>('mobile')!;
    return { minVersion: mobile.minVersion, storeUrls: mobile.storeUrls };
  }
}
