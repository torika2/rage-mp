import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { UpsertParkingDto } from './dto/parking.dto';

@Controller('parking')
export class ParkingController {
  constructor(private readonly parking: ParkingService) {}

  @Get()
  findAll() {
    return this.parking.findAll();
  }

  @Get(':spotId')
  findOne(@Param('spotId') spotId: string) {
    return this.parking.findOne(spotId);
  }

  @Put(':spotId')
  upsert(@Param('spotId') spotId: string, @Body() dto: UpsertParkingDto) {
    return this.parking.upsert(spotId, dto);
  }

  @Delete(':spotId')
  remove(@Param('spotId') spotId: string) {
    return this.parking.remove(spotId);
  }
}
