import { IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

// NOTE: status is intentionally NOT constrained with @IsIn here — an invalid status must reach the
// service so it can be logged as fraud, the account flagged, and the write rejected (not bounced
// with a generic 400 at the DTO layer).
export class CreateItemDto {
  @IsString() @Length(1, 64)
  itemId: string;

  @IsOptional() @IsInt() @Min(1)
  qty?: number;

  @IsString()
  status: string;

  // How the item appeared. Only 'bought'/'traded' are legitimate; anything else → fraud.
  // Not @IsIn-constrained so an invalid value reaches the service to be logged/flagged/rejected.
  @IsString()
  origin: string;

  @IsOptional() @IsInt()
  slot?: number;

  @IsOptional() @IsNumber() posX?: number;
  @IsOptional() @IsNumber() posY?: number;
  @IsOptional() @IsNumber() posZ?: number;
  @IsOptional() @IsInt() dim?: number;
}

export class UpdateItemDto {
  @IsOptional() @IsInt() @Min(1) qty?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() slot?: number;
  @IsOptional() @IsNumber() posX?: number;
  @IsOptional() @IsNumber() posY?: number;
  @IsOptional() @IsNumber() posZ?: number;
  @IsOptional() @IsInt() dim?: number;
}
