import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Upsert one car's tuning (keyed by model in the URL). */
export class UpsertCarTuningDto {
  @IsOptional() @IsString() @MaxLength(16) stage?: string;
  @IsOptional() @IsNumber() @Min(0.1) @Max(5) speed?: number;
}
