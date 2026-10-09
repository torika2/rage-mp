import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { KvService } from './kv.service';
import { PutKvDto } from './dto/kv.dto';

@Controller('kv')
export class KvController {
  constructor(private readonly kv: KvService) {}

  @Get(':namespace')
  get(@Param('namespace') namespace: string) {
    return this.kv.get(namespace);
  }

  @Put(':namespace')
  put(@Param('namespace') namespace: string, @Body() dto: PutKvDto) {
    return this.kv.put(namespace, dto.value);
  }
}
