import { IsObject } from 'class-validator';

/** Generic wrapper for a per-character JSON blob (equipment / clothing / tattoos). */
export class JsonBlobDto {
  @IsObject()
  data: Record<string, unknown>;
}
