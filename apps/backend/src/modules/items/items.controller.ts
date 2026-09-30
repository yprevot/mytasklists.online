import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto, ReorderItemsDto, UpdateItemDto } from './dto/item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { ItemStatus } from '../../database/entities';

@ApiTags('productos')
@ApiBearerAuth()
@Controller()
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get('lists/:listId/items')
  @ApiOperation({ summary: 'Productos de una lista' })
  findByList(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Query('status') status?: ItemStatus,
  ) {
    return this.items.findByList(listId, user.id, status);
  }

  @Post('lists/:listId/items')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agrega un producto (unico o recurrente) a la lista' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.items.create(listId, user.id, dto);
  }

  @Patch('lists/:listId/items/reorder')
  @ApiOperation({ summary: 'Reordena los productos pendientes' })
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.items.reorder(listId, user.id, dto);
  }

  @Delete('lists/:listId/items/purchased')
  @ApiOperation({ summary: 'Vacia la lista de comprados' })
  clearPurchased(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return this.items.clearPurchased(listId, user.id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Edita un producto o su recurrencia' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(id, user.id, dto);
  }

  @Post('items/:id/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marca el producto como comprado (pasa tachado a la lista de abajo)' })
  purchase(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.purchase(id, user.id);
  }

  @Post('items/:id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deshace la compra y regresa el producto a pendientes' })
  restore(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.restore(id, user.id);
  }

  @Delete('items/:id/close')
  @ApiOperation({
    summary: 'Cierra la tarjeta con la "x" (si es recurrente conserva su programacion)',
  })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.archive(id, user.id);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Elimina el producto por completo y cancela su recurrencia' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.remove(id, user.id);
  }
}
