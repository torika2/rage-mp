import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** A rentable parking spot's ownership/state (packages/parking parking.json `spots`). */
@Entity('parking_spots')
export class ParkingSpot {
  // The spot's string id (e.g. "P1").
  @PrimaryColumn({ name: 'spot_id', type: 'varchar', length: 32 })
  spotId: string;

  @Index()
  @Column({ name: 'owner_character_id', type: 'bigint', nullable: true, transformer: bigintToNumber })
  ownerCharacterId: number | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 64, nullable: true })
  ownerName: string | null;

  @Column({ name: 'expires_at', type: 'bigint', nullable: true, transformer: bigintToNumber })
  expiresAt: number | null;

  // Stored cars: [{ model, plate, fuel }].
  @Column({ type: 'json', nullable: true })
  cars: unknown[] | null;

  @Column({ type: 'int', default: 1 })
  slots: number;
}
