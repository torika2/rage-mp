import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { CarTuningService } from './car-tuning.service';
import { UpsertCarTuningDto } from './dto/car-tuning.dto';

@Controller('car-tuning')
export class CarTuningController {
  constructor(private readonly tuning: CarTuningService) {}

  @Get()
  findAll() {
    return this.tuning.findAll();
  }

  @Put(':model')
  upsert(@Param('model') model: string, @Body() dto: UpsertCarTuningDto) {
    return this.tuning.upsert(model, dto);
  }

  @Delete(':model')
  remove(@Param('model') model: string) {
    return this.tuning.remove(model);
  }
}
