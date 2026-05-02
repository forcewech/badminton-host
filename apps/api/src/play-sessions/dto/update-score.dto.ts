import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateScoreDto {
  @IsInt()
  @Min(0)
  @Type(() => Number)
  scoreA!: number;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  scoreB!: number;
}
