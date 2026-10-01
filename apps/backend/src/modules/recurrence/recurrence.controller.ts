import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecurrenceService } from './recurrence.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities';

@ApiTags('recurrencia')
@ApiBearerAuth()
@Controller('recurrence')
export class RecurrenceController {
  constructor(
    private readonly recurrence: RecurrenceService,
    private readonly config: ConfigService,
  ) {}

  @Post('run')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fuerza una pasada del motor de recurrencia (administración)' })
  run() {
    return this.recurrence.runSweep();
  }

  @Post('items/:id/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Adelanta el reloj de un producto N días y ejecuta el motor. Pensado para demos y pruebas automatizadas.',
  })
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { days?: number },
  ) {
    if (!this.config.get<boolean>('allowTimeTravel', false)) {
      throw new ForbiddenException('Esta utilidad está deshabilitada en producción');
    }
    const days = Number(body?.days ?? 1);
    if (!Number.isFinite(days) || days <= 0 || days > 3650) {
      throw new BadRequestException('`days` debe ser un número entre 1 y 3650');
    }
    return this.recurrence.advanceItem(id, user.id, days);
  }
}
