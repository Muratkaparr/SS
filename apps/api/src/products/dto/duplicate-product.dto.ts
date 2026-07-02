import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class DuplicateProductDto {
  @IsString()
  targetWarehouseId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  openingStock?: number;
}
