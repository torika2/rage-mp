import {
  IsArray,
  IsHexColor,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/** Found a new gang. The game server supplies the leader's character id and the default ranks. */
export class CreateGangDto {
  @IsString() @Length(2, 48) name: string;
  @IsString() @Length(2, 8) tag: string;
  @IsOptional() @IsString() @Length(1, 32) staticKey?: string | null;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() leaderCharacterId?: number | null;
  @IsOptional() @IsArray() members?: unknown[];
  @IsOptional() @IsArray() ranks?: unknown[];
  @IsOptional() @IsObject() base?: Record<string, unknown> | null;
  @IsOptional() @IsInt() @Min(0) treasury?: number;
  @IsOptional() @IsObject() stash?: Record<string, number>;
  @IsOptional() createdAt?: number;
}

/** Merge-update any subset of a gang's mutable state (what the game pushes on each change). */
export class UpdateGangDto {
  @IsOptional() @IsString() @Length(2, 48) name?: string;
  @IsOptional() @IsString() @Length(2, 8) tag?: string;
  @IsOptional() @IsString() @Length(1, 32) staticKey?: string | null;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() leaderCharacterId?: number | null;
  @IsOptional() @IsArray() members?: unknown[];
  @IsOptional() @IsArray() ranks?: unknown[];
  @IsOptional() @IsObject() base?: Record<string, unknown> | null;
  @IsOptional() @IsObject() interior?: Record<string, unknown> | null;
  @IsOptional() @IsInt() @Min(0) treasury?: number;
  @IsOptional() @IsObject() stash?: Record<string, number>;
  @IsOptional() @IsObject() crafting?: Record<string, unknown> | null;
}
