import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** A house in the registry, including its ownership + chest storage (packages/houses houses.json). */
@Entity('houses')
export class House {
  // Generated, but migration may insert explicit ids to preserve existing references.
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string | null;

  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  price: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  interior: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  building: string | null;

  @Column({ type: 'json', nullable: true })
  door: Record<string, unknown> | null;

  @Column({ name: 'door_model', type: 'varchar', length: 64, nullable: true })
  doorModel: string | null;

  @Column({ name: 'chest_point', type: 'json', nullable: true })
  chestPoint: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  garage: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  spawn: Record<string, unknown> | null;

  // Owner (null = unowned). character link + cached display name.
  @Index()
  @Column({ name: 'owner_character_id', type: 'bigint', nullable: true, transformer: bigintToNumber })
  ownerCharacterId: number | null;

  @Column({ name: 'owner_name', type: 'varchar', length: 64, nullable: true })
  ownerName: string | null;

  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @Column({ type: 'json', nullable: true })
  chest: Record<string, unknown> | null;

  @Column({ name: 'spawn_home', type: 'boolean', default: false })
  spawnHome: boolean;

  // Original creation timestamp (ms epoch) preserved from the JSON registry.
  @Column({ name: 'created_at', type: 'bigint', nullable: true, transformer: bigintToNumber })
  createdAt: number | null;
}
