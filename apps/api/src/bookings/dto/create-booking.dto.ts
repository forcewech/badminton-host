import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { CustomerGender, SkillLevel } from '../entities/booking.entity';
import { IsEnum } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsEnum(CustomerGender)
  gender!: CustomerGender;

  @IsEnum(SkillLevel)
  skillLevel!: SkillLevel;

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
