import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { House } from './house.entity';
import { HousesService } from './houses.service';
import { HousesController } from './houses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([House])],
  controllers: [HousesController],
  providers: [HousesService],
})
export class HousesModule {}
