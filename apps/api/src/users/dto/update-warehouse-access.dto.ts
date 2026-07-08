import { IsArray, IsString } from 'class-validator';

export class UpdateWarehouseAccessDto {
  /** Kullanıcının çalışabileceği depo id'leri. Boş dizi = kısıt yok (tüm depo havuzuna erişir). */
  @IsArray()
  @IsString({ each: true })
  warehouseIds!: string[];
}
