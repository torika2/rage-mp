import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { UpdateCharacterDto } from './dto/update-character.dto';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';
import { JsonBlobDto } from './dto/json-blob.dto';

@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.characters.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() changes: UpdateCharacterDto) {
    return this.characters.update(id, changes);
  }

  @Put(':id/appearance')
  updateAppearance(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAppearanceDto) {
    return this.characters.updateAppearance(id, dto.appearance);
  }

  @Put(':id/equipment')
  updateEquipment(@Param('id', ParseIntPipe) id: number, @Body() dto: JsonBlobDto) {
    return this.characters.setJsonField(id, 'equipment', dto.data);
  }

  @Put(':id/clothing')
  updateClothing(@Param('id', ParseIntPipe) id: number, @Body() dto: JsonBlobDto) {
    return this.characters.setJsonField(id, 'clothing', dto.data);
  }

  @Put(':id/tattoos')
  updateTattoos(@Param('id', ParseIntPipe) id: number, @Body() dto: JsonBlobDto) {
    return this.characters.setJsonField(id, 'tattoos', dto.data);
  }

  @Put(':id/position')
  updatePosition(@Param('id', ParseIntPipe) id: number, @Body() dto: JsonBlobDto) {
    return this.characters.setJsonField(id, 'lastPosition', dto.data);
  }
}
