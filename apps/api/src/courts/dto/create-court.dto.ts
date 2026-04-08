import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from "class-validator";

export class CreateCourtDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  zone!: string;

  @IsNumber()
  hourlyRate!: number;

  @IsBoolean()
  isActive!: boolean;
}
