import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

/** Registration payload — creates a user account AND their first character. */
export class RegisterDto {
  // --- character ---
  @IsString()
  @Length(2, 32)
  firstName: string;

  @IsString()
  @Length(2, 32)
  lastName: string;

  // Gender is NOT chosen at registration — it starts null and is picked via the in-game
  // chooser on login (and every login until set).

  // --- account ---
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Georgian personal number (პირადობის ნომერი): exactly 11 digits.
  @Matches(/^\d{11}$/, { message: 'residentNumber must be 11 digits' })
  residentNumber: string;

  // Georgian phone: +995 followed by 9 digits.
  @IsOptional()
  @Matches(/^\+995\d{9}$/, { message: 'phoneNumber must be in the form +995XXXXXXXXX' })
  phoneNumber?: string;

  // Supplied by the game server (player.socialClub). Required.
  @IsString()
  @Length(1, 64)
  socialClubName: string;

  // Supplied by the game server (player.ip).
  @IsOptional()
  @IsString()
  ipAddress?: string;
}
