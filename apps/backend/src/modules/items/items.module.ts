import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog, ListItem, ShoppingList, User } from '../../database/entities';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { ListsModule } from '../lists/lists.module';

@Module({
  imports: [TypeOrmModule.forFeature([ListItem, ShoppingList, User, ActivityLog]), ListsModule],
  providers: [ItemsService],
  controllers: [ItemsController],
  exports: [ItemsService],
})
export class ItemsModule {}
