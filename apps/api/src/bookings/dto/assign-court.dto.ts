import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class AssignCourtDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  courtId?: number | null;
}
