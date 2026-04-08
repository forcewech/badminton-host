import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityAvailable?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantityInUse?: number;

  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;

  @IsOptional()
  @IsString()
  conditionNotes?: string;
}
