import { IsString, Length } from 'class-validator';

export class LoginSocialDto {
  @IsString()
  @Length(1, 64)
  socialClubName: string;

  @IsString()
  password: string;
}
