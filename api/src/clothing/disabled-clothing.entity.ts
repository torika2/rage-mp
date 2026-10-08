import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A single clothing colour/texture an admin has disabled in the clothing shop.
 * Identified exactly like an inventory clothing item: gender + category + drawable + texture
 * (the same tuple that forms the `cloth_<cat>_<d>_<t>` item id in packages/inventory).
 * The game server loads all rows on boot into an in-memory set, then hides/blocks/force-removes them.
 */
@Entity('disabled_clothing')
@Index(['gender', 'cat', 'drawable', 'texture'], { unique: true })
export class DisabledClothing {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // 'm' | 'f' — male and female freemode share drawable indices but mean different clothes.
  @Column({ type: 'varchar', length: 1 })
  gender: string;

  // Clothing category key (e.g. 'top', 'pants', 'hat') from packages/clothing CATEGORIES.
  @Column({ type: 'varchar', length: 32 })
  cat: string;

  @Column({ type: 'int' })
  drawable: number;

  @Column({ type: 'int' })
  texture: number;
}
