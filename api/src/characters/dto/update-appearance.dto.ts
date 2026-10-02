import { IsObject } from 'class-validator';

/**
 * The appearance blob is validated in depth by the game server (packages/creator) before it
 * reaches here; the API only requires it to be a JSON object.
 */
export class UpdateAppearanceDto {
  @IsObject()
  appearance: Record<string, unknown>;
}
