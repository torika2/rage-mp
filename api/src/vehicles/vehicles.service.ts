import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto, UpdateVehicleDto } from './dto/vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(@InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>) {}

  findByCharacter(characterId: number): Promise<Vehicle[]> {
    return this.vehicles.findBy({ characterId });
  }

  async findOne(id: number): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOneBy({ id });
    if (!vehicle) throw new NotFoundException(`Vehicle ${id} not found`);
    return vehicle;
  }

  create(characterId: number, dto: CreateVehicleDto): Promise<Vehicle> {
    return this.vehicles.save(this.vehicles.create({ ...dto, characterId }));
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    return this.vehicles.save(this.vehicles.merge(vehicle, dto));
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const result = await this.vehicles.delete(id);
    if (!result.affected) throw new NotFoundException(`Vehicle ${id} not found`);
    return { deleted: true };
  }
}
