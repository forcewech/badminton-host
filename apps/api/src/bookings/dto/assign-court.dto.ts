import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class AssignCourtDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  courtId!: number;
}
