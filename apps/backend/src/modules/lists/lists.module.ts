import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ActivityLog,
  ListInvitation,
  ListItem,
  ListMember,
  ShoppingList,
  User,
} from '../../database/entities';
import { ListsService } from './lists.service';
import { ListsController } from './lists.controller';
import { ItemImageStorage } from '../items/item-image.storage';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingList, ListMember, ListInvitation, ListItem, User, ActivityLog])],
  providers: [ListsService, ItemImageStorage],
  controllers: [ListsController],
  exports: [ListsService, ItemImageStorage],
})
export class ListsModule {}
