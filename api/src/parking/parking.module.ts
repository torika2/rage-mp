import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParkingSpot } from './parking-spot.entity';
import { ParkingService } from './parking.service';
import { ParkingController } from './parking.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParkingSpot])],
  controllers: [ParkingController],
  providers: [ParkingService],
})
export class ParkingModule {}
