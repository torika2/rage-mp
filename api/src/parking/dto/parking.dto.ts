import { IsArray, IsInt, IsOptional } from 'class-validator';

/** Upsert a spot's rental state. */
export class UpsertParkingDto {
  @IsOptional() ownerCharacterId?: number | null;
  @IsOptional() ownerName?: string | null;
  @IsOptional() expiresAt?: number | null;
  @IsOptional() @IsArray() cars?: unknown[];
  @IsOptional() @IsInt() slots?: number;
}
