import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MovementType } from '@repo/shared-types';

export class CreateMovementDto {
  @IsString()
  productId!: string;

  @IsEnum(MovementType)
  type!: MovementType;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
