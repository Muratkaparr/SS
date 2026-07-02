import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  /** Ürünün ekleneceği depo (Ürünler sekmesinde aktif olan sekme). */
  @IsString()
  warehouseId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  safetyMarginDays?: number;

  @IsInt()
  @Min(0)
  criticalLevel!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  openingStock?: number;
}
