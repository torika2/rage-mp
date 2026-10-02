import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { HousesService } from './houses.service';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';

@Controller('houses')
export class HousesController {
  constructor(private readonly houses: HousesService) {}

  @Get()
  findAll() {
    return this.houses.findAll();
  }

  @Post()
  create(@Body() dto: CreateHouseDto) {
    return this.houses.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.houses.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHouseDto) {
    return this.houses.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.houses.remove(id);
  }
}
