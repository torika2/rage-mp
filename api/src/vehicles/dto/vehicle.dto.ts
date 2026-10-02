import { IsInt, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsInt()
  model: number;

  @IsOptional() @IsString() @Length(0, 64)
  modelName?: string;

  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
  @IsOptional() @IsNumber() z?: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsInt() dim?: number;

  @IsOptional() @IsString() @Length(0, 16)
  plate?: string;

  @IsOptional() @IsNumber() @Min(0) fuel?: number;
  @IsOptional() @IsNumber() @Min(0) km?: number;
}

/** Every field optional — the game server patches whatever changed. */
export class UpdateVehicleDto {
  @IsOptional() @IsNumber() x?: number;
  @IsOptional() @IsNumber() y?: number;
  @IsOptional() @IsNumber() z?: number;
  @IsOptional() @IsNumber() heading?: number;
  @IsOptional() @IsInt() dim?: number;

  @IsOptional() @IsString() @Length(0, 16)
  plate?: string;

  @IsOptional() @IsNumber() @Min(0) fuel?: number;
  @IsOptional() @IsNumber() @Min(0) km?: number;
}
