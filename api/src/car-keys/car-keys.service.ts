import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarKey } from './car-key.entity';
import { GrantCarKeyDto, RevokeCarKeyDto } from './dto/car-key.dto';

@Injectable()
export class CarKeysService {
  constructor(@InjectRepository(CarKey) private readonly keys: Repository<CarKey>) {}

  /** Every key, used by the game server to build its in-memory permission cache on boot. */
  findAll(): Promise<CarKey[]> {
    return this.keys.find();
  }

  /** Grant (idempotent on owner+grantee): updates the stored display name if it changed. */
  async grant(dto: GrantCarKeyDto): Promise<CarKey> {
    const existing = await this.keys.findOneBy({
      ownerSocialClub: dto.ownerSocialClub,
      granteeSocialClub: dto.granteeSocialClub,
    });
    const key = this.keys.merge(
      existing ?? this.keys.create({ ownerSocialClub: dto.ownerSocialClub, granteeSocialClub: dto.granteeSocialClub }),
      { granteeName: dto.granteeName ?? null },
    );
    return this.keys.save(key);
  }

  async revoke(dto: RevokeCarKeyDto): Promise<{ deleted: boolean }> {
    const result = await this.keys.delete({
      ownerSocialClub: dto.ownerSocialClub,
      granteeSocialClub: dto.granteeSocialClub,
    });
    return { deleted: !!result.affected };
  }
}
