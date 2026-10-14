import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmDoseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  transcript!: string;
}

export class DemoTriggerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  medicationId?: string;
}
