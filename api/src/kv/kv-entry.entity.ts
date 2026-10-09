import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * A whole JSON document per namespace — the SQL home of the gamemode's world/shared state that used
 * to live in packages/<name>/<name>.json (houses, parking, cityhall, police, ...).
 */
@Entity('kv_store')
export class KvEntry {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  namespace: string;

  @Column({ type: 'json' })
  value: unknown;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
