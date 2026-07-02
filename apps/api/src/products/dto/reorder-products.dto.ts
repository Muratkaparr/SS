import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderProductsDto {
  /** Ürünlerin gösterilmesini istediğiniz sırayla id listesi. */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
