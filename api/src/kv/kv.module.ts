import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KvEntry } from './kv-entry.entity';
import { KvService } from './kv.service';
import { KvController } from './kv.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KvEntry])],
  controllers: [KvController],
  providers: [KvService],
})
export class KvModule {}
