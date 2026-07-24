import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@repo/shared-types';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  name!: string;

  @IsEnum(Role)
  role!: Role;

  /** Sadece role=USER için: bu kullanıcı hangi Admin'in depo havuzuna erişecek (Platform Admin çağırıyorsa zorunlu). */
  @IsOptional()
  @IsString()
  adminOwnerId?: string;
}
