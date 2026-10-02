import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** TypeORM returns bigint as a string; keep money columns as JS numbers. */
const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** An in-game character belonging to a user account. */
@Entity('characters')
// RP servers require unique character names.
@Index(['firstName', 'lastName'], { unique: true })
export class Character {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @ManyToOne(() => User, (user) => user.characters, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'first_name', type: 'varchar', length: 32 })
  firstName: string;

  @Column({ name: 'last_name', type: 'varchar', length: 32 })
  lastName: string;

  // Mirrors the account's chosen gender; null until chosen.
  @Column({ type: 'char', length: 1, nullable: true })
  gender: string | null;

  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  money: number;

  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  bank: number;

  @Column({ type: 'float', default: 100 })
  hunger: number;

  @Column({ type: 'float', default: 100 })
  thirst: number;

  // Full character-creator result (heritage, face features, overlays, hair, eyes).
  // null = the creator has not been run yet → the login flow forces it.
  @Column({ type: 'json', nullable: true })
  appearance: Record<string, unknown> | null;

  // Worn clothing slots + weaponSlot (packages/inventory equipment.json).
  @Column({ type: 'json', nullable: true })
  equipment: Record<string, unknown> | null;

  // Worn clothing (packages/clothing clothing.json).
  @Column({ type: 'json', nullable: true })
  clothing: Record<string, unknown> | null;

  // Applied tattoos per body model (packages/tattoo tattoo.json).
  @Column({ type: 'json', nullable: true })
  tattoos: Record<string, unknown> | null;

  // Where the character logged out: { x, y, z, heading, dim }. Used by the rejoin spawn selector.
  @Column({ name: 'last_position', type: 'json', nullable: true })
  lastPosition: Record<string, unknown> | null;

  // false until the game server has seeded this character from the old local JSON saves
  // (packages/*/*.json) once; after that the database is the only source of truth.
  @Column({ name: 'legacy_imported', type: 'boolean', default: false })
  legacyImported: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
