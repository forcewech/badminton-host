import { IsInt, Max, Min } from 'class-validator';

export class UpdateQuickSlotDto {
  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers!: number;
}
