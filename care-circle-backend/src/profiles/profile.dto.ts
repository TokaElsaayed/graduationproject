import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  conditions?: string[];
}

export class MedicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  dose!: string;

  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  scheduleTimes!: string[];
}

export class UpdateMedicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  dose?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { each: true })
  scheduleTimes?: string[];
}

export class EmergencyContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  relationship!: string;

  @IsPhoneNumber('EG')
  phone!: string;

  @IsBoolean()
  isPrimary!: boolean;

  @IsBoolean()
  canViewDashboard!: boolean;
}

export class UpdateEmergencyContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  relationship?: string;

  @IsOptional()
  @IsPhoneNumber('EG')
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewDashboard?: boolean;
}
