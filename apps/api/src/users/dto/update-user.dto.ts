import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '@repo/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  /** Sadece Platform Admin değiştirebilir. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  /** Sadece Platform Admin bir USER hesabını başka bir Admin'in ekibine taşıyabilir. */
  @IsOptional()
  @IsString()
  adminOwnerId?: string;
}
