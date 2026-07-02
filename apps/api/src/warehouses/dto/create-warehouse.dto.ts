import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateWarehouseDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  location?: string;

  /** Sadece Platform Admin kullanır: depo başka bir Admin adına oluşturuluyorsa. */
  @IsOptional()
  @IsString()
  ownerId?: string;
}
