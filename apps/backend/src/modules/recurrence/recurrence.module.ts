import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog, ListItem, ShoppingList } from '../../database/entities';
import { RecurrenceService } from './recurrence.service';
import { RecurrenceController } from './recurrence.controller';
import { ListsModule } from '../lists/lists.module';

@Module({
  imports: [TypeOrmModule.forFeature([ListItem, ShoppingList, ActivityLog]), ListsModule],
  providers: [RecurrenceService],
  controllers: [RecurrenceController],
  exports: [RecurrenceService],
})
export class RecurrenceModule {}
