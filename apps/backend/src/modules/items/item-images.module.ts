import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ItemImageStorage } from './item-image.storage';
import { ItemImageAccessService } from './item-image-access.service';
import { ItemImageInterceptor } from './item-image.interceptor';

@Global()
@Module({ imports: [JwtModule.register({})],
  providers: [ItemImageStorage, ItemImageAccessService, { provide: APP_INTERCEPTOR, useClass: ItemImageInterceptor }],
  exports: [ItemImageStorage, ItemImageAccessService],
})
export class ItemImagesModule {}
