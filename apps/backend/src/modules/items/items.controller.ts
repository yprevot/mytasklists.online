import { ItemImageStorage } from './item-image.storage';
import { ItemImageAccessService } from './item-image-access.service';
import {
  Body,
  BadRequestException,
  PayloadTooLargeException,
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
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto, ReorderItemsDto, UpdateItemDto } from './dto/item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types';
import { ItemStatus } from '../../database/entities';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('productos')
@ApiBearerAuth()
@Controller()
export class ItemsController {
  constructor(private readonly items: ItemsService, private readonly imageAccess: ItemImageAccessService, private readonly imageStorage: ItemImageStorage) {}

  @Public()
  @Get('items/images/:filename')
  async image(@Param('filename') filename: string, @Query('grant') grant: string | undefined, @Res() reply: FastifyReply) {
    await this.imageAccess.authorize(filename, grant);
    const result = await this.items.readImage(filename);
    return reply.type(result.contentType).header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff').send(result.buffer);
  }

  @Post('items/:id/image')
  async uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FastifyRequest,
  ) {
    return this.imageStorage.limited(async () => {
    try {
      const file = await request.file();
      if (!file) throw new BadRequestException('Selecciona una imagen.');
      return await this.items.uploadImage(id, user.id, await file.toBuffer(), file.mimetype);
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new PayloadTooLargeException('La imagen no puede superar 5 MB.');
      }
      throw error;
    }
    });
  }

  @Delete('items/:id/image')
  removeImage(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.items.removeImage(id, user.id);
  }

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
  @ApiOperation({ summary: 'Agrega un producto (único o recurrente) a la lista' })
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
  @ApiOperation({ summary: 'Vacía la lista de comprados' })
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
    summary: 'Cierra la tarjeta con la "x" (si es recurrente conserva su programación)',
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
