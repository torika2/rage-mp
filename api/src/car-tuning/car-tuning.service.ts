import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarTuning } from './car-tuning.entity';
import { UpsertCarTuningDto } from './dto/car-tuning.dto';

@Injectable()
export class CarTuningService {
  constructor(@InjectRepository(CarTuning) private readonly tuning: Repository<CarTuning>) {}

  /** Every tuned car, used by the game server to build its in-memory cache on boot. */
  findAll(): Promise<CarTuning[]> {
    return this.tuning.find();
  }

  /** Upsert one car's tuning (keyed by model). */
  async upsert(model: string, dto: UpsertCarTuningDto): Promise<CarTuning> {
    const existing = await this.tuning.findOneBy({ model });
    const row = this.tuning.merge(existing ?? this.tuning.create({ model }), dto);
    return this.tuning.save(row);
  }

  /** Clear a car back to stock. Idempotent — clearing an untuned car is not an error. */
  async remove(model: string): Promise<{ deleted: boolean }> {
    const result = await this.tuning.delete({ model });
    return { deleted: !!result.affected };
  }
}
