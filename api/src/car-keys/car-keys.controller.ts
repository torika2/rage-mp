import { Body, Controller, Get, Post } from '@nestjs/common';
import { CarKeysService } from './car-keys.service';
import { GrantCarKeyDto, RevokeCarKeyDto } from './dto/car-key.dto';

@Controller('car-keys')
export class CarKeysController {
  constructor(private readonly carKeys: CarKeysService) {}

  @Get()
  findAll() {
    return this.carKeys.findAll();
  }

  @Post()
  grant(@Body() dto: GrantCarKeyDto) {
    return this.carKeys.grant(dto);
  }

  // DELETE with a body is awkward across clients, so revoke is a POST.
  @Post('revoke')
  revoke(@Body() dto: RevokeCarKeyDto) {
    return this.carKeys.revoke(dto);
  }
}
