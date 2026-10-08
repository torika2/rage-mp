import { Body, Controller, Get, Post } from '@nestjs/common';
import { ClothingService } from './clothing.service';
import { DisabledClothingDto } from './dto/disabled-clothing.dto';

@Controller('clothing/disabled')
export class ClothingController {
  constructor(private readonly clothing: ClothingService) {}

  @Get()
  findAll() {
    return this.clothing.findAll();
  }

  @Post()
  disable(@Body() dto: DisabledClothingDto) {
    return this.clothing.disable(dto);
  }

  // DELETE with a body is awkward across clients, so re-enable is a POST (same style as car-keys revoke).
  @Post('enable')
  enable(@Body() dto: DisabledClothingDto) {
    return this.clothing.enable(dto);
  }
}
