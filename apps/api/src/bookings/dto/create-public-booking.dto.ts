import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { CustomerGender, SkillLevel } from '../entities/booking.entity';

export class CreatePublicBookingDto {
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

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  photoPublicId?: string;
}
