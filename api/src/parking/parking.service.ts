import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParkingSpot } from './parking-spot.entity';
import { UpsertParkingDto } from './dto/parking.dto';

@Injectable()
export class ParkingService {
  constructor(@InjectRepository(ParkingSpot) private readonly spots: Repository<ParkingSpot>) {}

  findAll(): Promise<ParkingSpot[]> {
    return this.spots.find();
  }

  async findOne(spotId: string): Promise<ParkingSpot> {
    const spot = await this.spots.findOneBy({ spotId });
    if (!spot) throw new NotFoundException(`Parking spot '${spotId}' not found`);
    return spot;
  }

  async upsert(spotId: string, dto: UpsertParkingDto): Promise<ParkingSpot> {
    const existing = await this.spots.findOneBy({ spotId });
    const spot = this.spots.merge(existing ?? this.spots.create({ spotId }), dto);
    return this.spots.save(spot);
  }

  async remove(spotId: string): Promise<{ deleted: true }> {
    const result = await this.spots.delete({ spotId });
    if (!result.affected) throw new NotFoundException(`Parking spot '${spotId}' not found`);
    return { deleted: true };
  }
}
