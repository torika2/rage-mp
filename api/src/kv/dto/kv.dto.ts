import { IsDefined } from 'class-validator';

export class PutKvDto {
  @IsDefined()
  value: unknown;
}
