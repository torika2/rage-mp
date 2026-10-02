import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('characters/:characterId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  async get(@Param('characterId', ParseIntPipe) characterId: number) {
    return { slots: await this.inventory.getGrid(characterId) };
  }

  @Put()
  async replace(
    @Param('characterId', ParseIntPipe) characterId: number,
    @Body('slots') slots: ({ id: string; qty: number } | null)[],
  ) {
    return { slots: await this.inventory.replaceGrid(characterId, slots) };
  }
}
