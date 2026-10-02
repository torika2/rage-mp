import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { House } from './house.entity';
import { CreateHouseDto, UpdateHouseDto } from './dto/house.dto';

@Injectable()
export class HousesService {
  constructor(@InjectRepository(House) private readonly houses: Repository<House>) {}

  findAll(): Promise<House[]> {
    return this.houses.find();
  }

  async findOne(id: number): Promise<House> {
    const house = await this.houses.findOneBy({ id });
    if (!house) throw new NotFoundException(`House ${id} not found`);
    return house;
  }

  create(dto: CreateHouseDto): Promise<House> {
    return this.houses.save(this.houses.create(dto));
  }

  async update(id: number, dto: UpdateHouseDto): Promise<House> {
    const house = await this.findOne(id);
    return this.houses.save(this.houses.merge(house, dto));
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const result = await this.houses.delete(id);
    if (!result.affected) throw new NotFoundException(`House ${id} not found`);
    return { deleted: true };
  }
}
