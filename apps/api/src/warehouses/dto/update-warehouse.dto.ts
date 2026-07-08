import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  location?: string;

  /** Sadece bu depo bir alt depoyken (parentId dolu) anlamlıdır. */
  @IsOptional()
  @IsBoolean()
  includeInParentTotal?: boolean;

  /** Bu depo çocuklara sahipse, birleşik ("Bütün Ürünler") sekmesinin gösterim adı. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  allChildrenLabel?: string;

  /** Depoyu başka bir üst deponun altına taşımak için. `null` gönderilirse depo bağımsız bir Ana Depo yapılır. */
  @IsOptional()
  @IsString()
  parentId?: string | null;
}
