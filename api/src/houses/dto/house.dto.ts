import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateHouseDto {
  // Optional explicit id (migration preserves existing house ids).
  @IsOptional() @IsInt() id?: number;

  @IsOptional() @IsString() @Length(0, 128) name?: string;
  @IsOptional() @IsInt() price?: number;
  @IsOptional() @IsString() @Length(0, 32) interior?: string;
  @IsOptional() @IsString() @Length(0, 32) building?: string;
  @IsOptional() @IsObject() door?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(0, 64) doorModel?: string;
  @IsOptional() @IsObject() chestPoint?: Record<string, unknown>;
  @IsOptional() @IsObject() garage?: Record<string, unknown>;
  @IsOptional() @IsObject() spawn?: Record<string, unknown>;
  @IsOptional() @IsInt() ownerCharacterId?: number;
  @IsOptional() @IsString() @Length(0, 64) ownerName?: string;
  @IsOptional() @IsBoolean() locked?: boolean;
  @IsOptional() @IsObject() chest?: Record<string, unknown>;
  @IsOptional() @IsBoolean() spawnHome?: boolean;
  @IsOptional() @IsInt() createdAt?: number;
}

/** All fields optional — patch anything, commonly owner/locked/chest. */
export class UpdateHouseDto {
  @IsOptional() @IsString() @Length(0, 128) name?: string;
  @IsOptional() @IsInt() price?: number;
  @IsOptional() @IsString() @Length(0, 32) interior?: string;
  @IsOptional() @IsString() @Length(0, 32) building?: string;
  @IsOptional() @IsObject() door?: Record<string, unknown>;
  @IsOptional() @IsString() @Length(0, 64) doorModel?: string;
  @IsOptional() @IsObject() chestPoint?: Record<string, unknown>;
  @IsOptional() @IsObject() garage?: Record<string, unknown>;
  @IsOptional() @IsObject() spawn?: Record<string, unknown>;
  // nullable: pass null to clear ownership
  @IsOptional() ownerCharacterId?: number | null;
  @IsOptional() ownerName?: string | null;
  @IsOptional() @IsBoolean() locked?: boolean;
  @IsOptional() @IsObject() chest?: Record<string, unknown>;
  @IsOptional() @IsBoolean() spawnHome?: boolean;
}
