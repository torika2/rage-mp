import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisabledClothing } from './disabled-clothing.entity';
import { DisabledClothingDto } from './dto/disabled-clothing.dto';

@Injectable()
export class ClothingService {
  constructor(
    @InjectRepository(DisabledClothing) private readonly disabled: Repository<DisabledClothing>,
  ) {}

  /** Every disabled colour, used by the game server to build its in-memory set on boot. */
  findAll(): Promise<DisabledClothing[]> {
    return this.disabled.find();
  }

  /** Disable a colour (idempotent on the gender+cat+drawable+texture tuple). */
  async disable(dto: DisabledClothingDto): Promise<DisabledClothing> {
    const existing = await this.disabled.findOneBy(dto);
    if (existing) return existing;
    return this.disabled.save(this.disabled.create(dto));
  }

  /** Re-enable a colour. */
  async enable(dto: DisabledClothingDto): Promise<{ deleted: boolean }> {
    const result = await this.disabled.delete(dto);
    return { deleted: !!result.affected };
  }
}
