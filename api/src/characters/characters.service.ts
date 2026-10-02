import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from './character.entity';
import { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
  ) {}

  async findOne(id: number): Promise<Character> {
    const character = await this.characters.findOneBy({ id });
    if (!character) {
      throw new NotFoundException(`Character ${id} not found`);
    }
    return character;
  }

  findByUser(userId: number): Promise<Character[]> {
    return this.characters.findBy({ userId });
  }

  /** Persist gameplay state (money, needs, …). */
  async update(id: number, changes: UpdateCharacterDto): Promise<Character> {
    const character = await this.findOne(id);
    return this.characters.save(this.characters.merge(character, changes));
  }

  /** Persist the character-creator result. */
  async updateAppearance(id: number, appearance: Record<string, unknown>): Promise<Character> {
    return this.setJsonField(id, 'appearance', appearance);
  }

  /** Set one of the per-character JSON blobs (appearance/equipment/clothing/tattoos). */
  async setJsonField(
    id: number,
    field: 'appearance' | 'equipment' | 'clothing' | 'tattoos' | 'lastPosition',
    value: Record<string, unknown>,
  ): Promise<Character> {
    const character = await this.findOne(id);
    Object.assign(character, { [field]: value });
    return this.characters.save(character);
  }
}
