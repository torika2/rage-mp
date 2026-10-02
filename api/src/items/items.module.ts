import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './item.entity';
import { FraudLog } from './fraud-log.entity';
import { Character } from '../characters/character.entity';
import { User } from '../users/user.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Item, FraudLog, Character, User])],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
