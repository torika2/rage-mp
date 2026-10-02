import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// The only legitimate states an item instance can be in. Anything else is treated as fraud.
export type ItemStatus = 'inventory' | 'dropped';
export const ITEM_STATUSES: ItemStatus[] = ['inventory', 'dropped'];

// The only legitimate ways a NEW item can come into existence. Anything else is treated as fraud.
export type ItemOrigin = 'bought' | 'traded';
export const ITEM_ORIGINS: ItemOrigin[] = ['bought', 'traded'];

/**
 * One item instance. It always has an owner (the character it belongs to) and a status describing
 * where it legitimately is: `inventory` (in that character's inventory) or `dropped` (left in the
 * world, still owned by them). Status is stored as a string and validated in code so an unknown
 * value can be caught, logged and flagged rather than silently accepted.
 */
@Entity('items')
export class Item {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ name: 'owner_character_id', type: 'bigint' })
  ownerCharacterId: number;

  @Column({ name: 'item_id', type: 'varchar', length: 64 })
  itemId: string;

  @Column({ type: 'int', default: 1 })
  qty: number;

  @Index()
  @Column({ type: 'varchar', length: 24, default: 'inventory' })
  status: string;

  // How this item came to exist (bought | traded). Recorded for provenance/fraud auditing.
  @Column({ type: 'varchar', length: 24, nullable: true })
  origin: string | null;

  // inventory: slot index. dropped: world position + dimension. (unused fields stay null)
  @Column({ type: 'int', nullable: true })
  slot: number | null;

  @Column({ name: 'pos_x', type: 'double', nullable: true })
  posX: number | null;

  @Column({ name: 'pos_y', type: 'double', nullable: true })
  posY: number | null;

  @Column({ name: 'pos_z', type: 'double', nullable: true })
  posZ: number | null;

  @Column({ type: 'int', nullable: true })
  dim: number | null;

  // When the item was dropped; a sweeper removes dropped items 2 minutes after this.
  @Column({ name: 'dropped_at', type: 'datetime', nullable: true })
  droppedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
