import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class CreateQuickSlotDto {
  @IsDateString()
  bookingDate!: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPlayers?: number;
}
