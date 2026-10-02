import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Character } from '../characters/character.entity';

export type UserType = 'admin' | 'default' | 'support';
export const USER_TYPES: UserType[] = ['admin', 'default', 'support'];

export type Gender = 'm' | 'f';
export const GENDERS: Gender[] = ['m', 'f'];

/** A player account. One account owns one or more characters. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // RAGE:MP social-club name (player.socialClub) — the Rockstar account anchor.
  // Required and unique: one server account per Social Club account.
  @Index({ unique: true })
  @Column({ name: 'social_club_name', type: 'varchar', length: 64 })
  socialClubName: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Never selected by default, never serialized back to clients.
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  // Georgian personal number (პირადობის ნომერი) — 11 digits.
  @Index({ unique: true })
  @Column({ name: 'resident_number', type: 'varchar', length: 11 })
  residentNumber: string;

  // Registration / last-known IP (fits IPv4 and IPv6).
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  // null = never attempted, true/false = verification result.
  @Column({ name: 'is_email_validated', type: 'boolean', nullable: true })
  isEmailValidated: boolean | null;

  // Georgian format: +995 followed by 9 digits.
  @Index({ unique: true })
  @Column({ name: 'phone_number', type: 'varchar', length: 16, nullable: true })
  phoneNumber: string | null;

  @Column({ name: 'is_phone_validated', type: 'boolean', nullable: true })
  isPhoneValidated: boolean | null;

  // Account role. New accounts are 'default'; promote to 'admin'/'support' out-of-band.
  @Column({ name: 'user_type', type: 'enum', enum: USER_TYPES, default: 'default' })
  userType: UserType;

  // Chosen body. null = not yet chosen → the login flow forces a choice every time until set.
  @Column({ type: 'enum', enum: GENDERS, nullable: true })
  gender: Gender | null;

  @OneToMany(() => Character, (character) => character.user)
  characters: Character[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
