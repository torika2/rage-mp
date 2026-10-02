import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** A recorded potential-fraud event (e.g. an item seen with an invalid status). */
@Entity('fraud_log')
export class FraudLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', nullable: true })
  userId: number | null;

  @Column({ name: 'character_id', type: 'bigint', nullable: true })
  characterId: number | null;

  @Column({ name: 'item_id', type: 'varchar', length: 64, nullable: true })
  itemId: string | null;

  @Column({ name: 'bad_status', type: 'varchar', length: 64, nullable: true })
  badStatus: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
