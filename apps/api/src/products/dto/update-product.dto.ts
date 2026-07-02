import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['openingStock', 'warehouseId'] as const),
) {
  /** "Bütün Ürünler" görünümünden düzenlendiğinde, aynı isme sahip diğer depolardaki ürünlere de uygulanır. */
  @IsOptional()
  @IsBoolean()
  applyToAllWarehouses?: boolean;
}
