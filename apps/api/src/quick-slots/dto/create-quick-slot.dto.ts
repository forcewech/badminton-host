import { IsDateString, Matches } from 'class-validator';

export class CreateQuickSlotDto {
  @IsDateString()
  bookingDate!: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;
}
