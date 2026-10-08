import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisabledClothing } from './disabled-clothing.entity';
import { ClothingService } from './clothing.service';
import { ClothingController } from './clothing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DisabledClothing])],
  controllers: [ClothingController],
  providers: [ClothingService],
})
export class ClothingModule {}
