import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gang } from './gang.entity';
import { CreateGangDto, UpdateGangDto } from './dto/gang.dto';

@Injectable()
export class GangsService {
  constructor(@InjectRepository(Gang) private readonly gangs: Repository<Gang>) {}

  /** Every gang, used by the game server to build its in-memory cache on boot. */
  findAll(): Promise<Gang[]> {
    return this.gangs.find();
  }

  async findOne(id: number): Promise<Gang> {
    const gang = await this.gangs.findOneBy({ id });
    if (!gang) throw new NotFoundException(`Gang ${id} not found`);
    return gang;
  }

  create(dto: CreateGangDto): Promise<Gang> {
    const gang = this.gangs.create({
      members: [],
      ranks: [],
      stash: {},
      treasury: 0,
      createdAt: Date.now(),
      ...dto,
    });
    return this.gangs.save(gang);
  }

  /** Merge-update (so a partial push never wipes untouched columns). */
  async update(id: number, dto: UpdateGangDto): Promise<Gang> {
    const gang = await this.findOne(id);
    return this.gangs.save(this.gangs.merge(gang, dto));
  }

  async remove(id: number): Promise<{ deleted: boolean }> {
    const result = await this.gangs.delete({ id });
    return { deleted: !!result.affected };
  }
}
