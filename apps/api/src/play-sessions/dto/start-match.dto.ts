import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class StartMatchDto {
  @IsInt()
  @Type(() => Number)
  courtNumber!: number;

  @IsInt()
  @Type(() => Number)
  teamAPlayer1Id!: number;

  @IsInt()
  @Type(() => Number)
  teamAPlayer2Id!: number;

  @IsInt()
  @Type(() => Number)
  teamBPlayer1Id!: number;

  @IsInt()
  @Type(() => Number)
  teamBPlayer2Id!: number;
}
