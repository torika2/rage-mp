import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A drive key: the owner (by Social Club) let another player (by Social Club) drive their car.
 * Matches the in-world ownership tag `veh:ownerSc` used by packages/vehicles. Drive-only.
 */
@Entity('car_keys')
@Index(['ownerSocialClub', 'granteeSocialClub'], { unique: true })
export class CarKey {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'owner_social_club', type: 'varchar', length: 64 })
  ownerSocialClub: string;

  @Index()
  @Column({ name: 'grantee_social_club', type: 'varchar', length: 64 })
  granteeSocialClub: string;

  @Column({ name: 'grantee_name', type: 'varchar', length: 64, nullable: true })
  granteeName: string | null;
}
