import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Live per-car tuning set by admins (packages/admin/carspeed.js), keyed by the lowercased spawn
 * model name (e.g. `mansm8c`). `stage` '' = no preset stage; `speed` 1 = stock. A row exists only
 * while a car is tuned away from stock — clearing a car deletes its row.
 */
@Entity('car_tuning')
export class CarTuning {
  @PrimaryColumn({ name: 'model', type: 'varchar', length: 64 })
  model: string;

  @Column({ name: 'stage', type: 'varchar', length: 16, default: '' })
  stage: string;

  @Column({ name: 'speed', type: 'float', default: 1 })
  speed: number;
}
