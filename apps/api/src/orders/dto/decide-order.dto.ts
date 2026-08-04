import { IsOptional, IsString } from 'class-validator';

export class DecideOrderDto {
  @IsOptional()
  @IsString()
  note?: string;
}
