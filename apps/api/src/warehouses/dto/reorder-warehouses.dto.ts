import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class ReorderWarehousesDto {
  /** Depoların gösterilmesini istediğiniz sırayla id listesi. */
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
