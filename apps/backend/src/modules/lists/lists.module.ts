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

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingList, ListMember, ListInvitation, ListItem, User, ActivityLog])],
  providers: [ListsService],
  controllers: [ListsController],
  exports: [ListsService],
})
export class ListsModule {}
