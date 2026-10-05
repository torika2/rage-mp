import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { GangsService } from './gangs.service';
import { CreateGangDto, UpdateGangDto } from './dto/gang.dto';

@Controller('gangs')
export class GangsController {
  constructor(private readonly gangs: GangsService) {}

  @Get()
  findAll() {
    return this.gangs.findAll();
  }

  @Post()
  create(@Body() dto: CreateGangDto) {
    return this.gangs.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.gangs.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGangDto) {
    return this.gangs.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.gangs.remove(id);
  }
}
