import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

const bigintToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * A player-run gang (packages/gangs). The game server keeps an authoritative in-memory cache and
 * writes through to this row on every mutation (membership, ranks, base, treasury, stash, crafting).
 * JSON columns hold the live shapes the game uses verbatim so no translation layer is needed.
 */
@Entity('gangs')
export class Gang {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 48 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 8 })
  tag: string;

  // Set for server-seeded "static" gangs (e.g. 'greens'); null for player-founded gangs. Code owns a
  // static gang's name/tag/colour/base — it is reconciled from config on every boot and can't be disbanded.
  @Index({ unique: true })
  @Column({ name: 'static_key', type: 'varchar', length: 32, nullable: true })
  staticKey: string | null;

  // Chat/blip colour, hex (e.g. '#e0a94b').
  @Column({ type: 'varchar', length: 9, default: '#c0392b' })
  color: string;

  @Index()
  @Column({ name: 'leader_character_id', type: 'bigint', nullable: true, transformer: bigintToNumber })
  leaderCharacterId: number | null;

  // [{ characterId, socialClub, name, rank, joinedAt }]
  @Column({ type: 'json' })
  members: unknown[];

  // [{ key, label, level, permissions:[] }] — the gang's rank ladder.
  @Column({ type: 'json' })
  ranks: unknown[];

  // { x, y, z, dim } location of the gang base, or null until the leader sets one.
  @Column({ type: 'json', nullable: true })
  base: Record<string, unknown> | null;

  // { x, y, z, h } teleport target inside the members-only HQ interior, or null. Captured in-game with
  // /gsethq (admin) — overrides the code default so the HQ can be aimed at an installed interior mod.
  @Column({ type: 'json', nullable: true })
  interior: Record<string, unknown> | null;

  // Shared gang bank balance.
  @Column({ type: 'bigint', default: 0, transformer: bigintToNumber })
  treasury: number;

  // Shared item stash: { "<itemId>": qty, ... }.
  @Column({ type: 'json' })
  stash: Record<string, number>;

  // Active craft job: { recipe, finishAt, by } or null when idle.
  @Column({ type: 'json', nullable: true })
  crafting: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'bigint', nullable: true, transformer: bigintToNumber })
  createdAt: number | null;
}
