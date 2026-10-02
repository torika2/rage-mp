import { IsBoolean, IsIn, IsNumber, IsOptional, Min } from 'class-validator';

/** Gameplay-state update — the game server sends only what changed. */
export class UpdateCharacterDto {
  @IsOptional()
  @IsIn(['m', 'f'])
  gender?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  money?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bank?: number;

  @IsOptional()
  @IsNumber()
  hunger?: number;

  @IsOptional()
  @IsNumber()
  thirst?: number;

  @IsOptional()
  @IsBoolean()
  legacyImported?: boolean;
}
