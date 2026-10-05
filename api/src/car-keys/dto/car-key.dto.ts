import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Grant a drive key (owner lets grantee drive their car). */
export class GrantCarKeyDto {
  @IsString() @MaxLength(64) ownerSocialClub: string;
  @IsString() @MaxLength(64) granteeSocialClub: string;
  @IsOptional() @IsString() @MaxLength(64) granteeName?: string | null;
}

/** Revoke a previously granted drive key. */
export class RevokeCarKeyDto {
  @IsString() @MaxLength(64) ownerSocialClub: string;
  @IsString() @MaxLength(64) granteeSocialClub: string;
}
