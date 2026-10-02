import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto';

@Controller()
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get('characters/:characterId/items')
  findByCharacter(@Param('characterId', ParseIntPipe) characterId: number) {
    return this.items.findByCharacter(characterId);
  }

  @Post('characters/:characterId/items')
  create(@Param('characterId', ParseIntPipe) characterId: number, @Body() dto: CreateItemDto) {
    return this.items.create(characterId, dto);
  }

  @Get('items/:id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.items.findOne(id);
  }

  @Put('items/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.items.update(id, dto);
  }

  @Delete('items/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.items.remove(id);
  }

  // Review recent potential-fraud events.
  @Get('fraud-log')
  recentFraud(@Query('limit') limit?: string) {
    return this.items.recentFraud(limit ? Number(limit) : 100);
  }
}
