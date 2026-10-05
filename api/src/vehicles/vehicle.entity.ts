import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** TypeORM returns bigint as string; keep the model hash numeric. */
const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** A vehicle owned by a character (packages/vehicles vehicles.json). */
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'character_id', type: 'bigint' })
  characterId: number;

  @Column({ type: 'bigint', transformer: bigintToNumber })
  model: number;

  @Column({ name: 'model_name', type: 'varchar', length: 64, nullable: true })
  modelName: string | null;

  @Column({ type: 'double', default: 0 })
  x: number;

  @Column({ type: 'double', default: 0 })
  y: number;

  @Column({ type: 'double', default: 0 })
  z: number;

  @Column({ type: 'double', default: 0 })
  heading: number;

  @Column({ type: 'int', default: 0 })
  dim: number;

  @Column({ type: 'varchar', length: 16, nullable: true })
  plate: string | null;

  @Column({ type: 'float', default: 100 })
  fuel: number;

  // The fuel GRADE currently in the tank: { power, eff, speedRate, rating }. Null = default grade.
  // Persisted so a reconnecting owner keeps the premium fuel they paid for. packages/economy owns it.
  @Column({ type: 'json', nullable: true })
  octane: { power: number; eff: number; speedRate: number; rating: number } | null;

  @Column({ type: 'double', default: 0 })
  km: number;

  // Per-car performance tuning bought at the garage: { engine, topSpeed, launch } upgrade levels
  // (0 = stock). Null until the car is tuned. packages/cartuning owns the level→effect mapping.
  @Column({ type: 'json', nullable: true })
  tuning: { engine: number; topSpeed: number; launch: number } | null;

  // Per-car visual customization bought at the garage: colors, wheels, body mods, window tint, etc.
  // Null until customized. Shape is owned by packages/cartuning; applied client-side for all players.
  @Column({ type: 'json', nullable: true })
  visual: Record<string, unknown> | null;
}
