import { IsString, MinLength } from 'class-validator';

export class UpdateRootLabelDto {
  /** Kök seviye "Bütün Ürünler" sekmesinin bu Admin için özelleştirilmiş adı. */
  @IsString()
  @MinLength(1)
  label!: string;
}
