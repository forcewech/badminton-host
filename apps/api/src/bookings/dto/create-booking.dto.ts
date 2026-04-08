import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Matches, Min } from 'class-validator';
import { CustomerGender } from '../entities/booking.entity';
import { IsEnum } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsEnum(CustomerGender)
  gender!: CustomerGender;

  @IsDateString()
  bookingDate!: string;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  endTime!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  depositAmount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
