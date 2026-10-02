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

  @Column({ type: 'double', default: 0 })
  km: number;
}
