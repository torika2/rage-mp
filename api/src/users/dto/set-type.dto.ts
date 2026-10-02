import { IsIn } from 'class-validator';
import { USER_TYPES, UserType } from '../user.entity';

export class SetTypeDto {
  @IsIn(USER_TYPES)
  userType: UserType;
}
