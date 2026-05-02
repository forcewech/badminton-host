import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsNotEmpty, Min } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  numberOfCourts!: number;
}
