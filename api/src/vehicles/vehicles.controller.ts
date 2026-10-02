import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Controller()
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('characters/:characterId/vehicles')
  findByCharacter(@Param('characterId', ParseIntPipe) characterId: number) {
    return this.vehicles.findByCharacter(characterId);
  }

  @Post('characters/:characterId/vehicles')
  create(@Param('characterId', ParseIntPipe) characterId: number, @Body() dto: CreateVehicleDto) {
    return this.vehicles.create(characterId, dto);
  }

  @Get('vehicles/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.findOne(id);
  }

  @Put('vehicles/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto);
  }

  @Delete('vehicles/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicles.remove(id);
  }
}
