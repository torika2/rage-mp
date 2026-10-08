import { IsIn, IsInt, IsString, MaxLength, Min } from 'class-validator';

/**
 * Disable (or re-enable) a clothing entry: gender + category + drawable + texture.
 * texture >= 0 disables that one colour; texture === -1 disables the WHOLE drawable (all its colours).
 */
export class DisabledClothingDto {
  @IsIn(['m', 'f']) gender: string;
  @IsString() @MaxLength(32) cat: string;
  @IsInt() @Min(0) drawable: number;
  @IsInt() @Min(-1) texture: number;
}
