import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarKey } from './car-key.entity';
import { CarKeysService } from './car-keys.service';
import { CarKeysController } from './car-keys.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CarKey])],
  controllers: [CarKeysController],
  providers: [CarKeysService],
})
export class CarKeysModule {}
