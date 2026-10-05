import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarTuning } from './car-tuning.entity';
import { CarTuningService } from './car-tuning.service';
import { CarTuningController } from './car-tuning.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CarTuning])],
  controllers: [CarTuningController],
  providers: [CarTuningService],
})
export class CarTuningModule {}
