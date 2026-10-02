import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** One occupied inventory slot for a character (empty slots are simply absent). */
@Entity('inventory_items')
@Index(['characterId', 'slot'], { unique: true })
export class InventoryItem {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'character_id', type: 'bigint' })
  characterId: number;

  @Column({ type: 'int' })
  slot: number;

  @Column({ name: 'item_id', type: 'varchar', length: 64 })
  itemId: string;

  @Column({ type: 'int', default: 1 })
  qty: number;
}
