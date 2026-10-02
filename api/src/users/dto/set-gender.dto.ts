import { IsIn } from 'class-validator';
import { GENDERS, Gender } from '../user.entity';

export class SetGenderDto {
  @IsIn(GENDERS)
  gender: Gender;
}
