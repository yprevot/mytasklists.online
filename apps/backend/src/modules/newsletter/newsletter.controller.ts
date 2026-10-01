import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SensitiveThrottle } from '../../common/throttle/throttle-profiles';
import { SubscribeNewsletterDto } from './newsletter.dto';
import { NewsletterService } from './newsletter.service';

@ApiTags('boletín')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  /** La landing solo muestra el formulario si el boletín está configurado */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Indica si el alta en el boletín está disponible' })
  status(): { enabled: boolean } {
    return { enabled: this.newsletter.enabled };
  }

  @Public()
  @SensitiveThrottle()
  @Post('subscribe')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Alta en el boletín (Listmonk envía el correo de confirmación)' })
  async subscribe(@Body() dto: SubscribeNewsletterDto): Promise<{ ok: true }> {
    await this.newsletter.subscribe(dto);
    return { ok: true };
  }
}
