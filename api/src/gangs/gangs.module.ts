import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gang } from './gang.entity';
import { GangsService } from './gangs.service';
import { GangsController } from './gangs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Gang])],
  controllers: [GangsController],
  providers: [GangsService],
})
export class GangsModule {}
