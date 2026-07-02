import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@repo/shared-types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
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
