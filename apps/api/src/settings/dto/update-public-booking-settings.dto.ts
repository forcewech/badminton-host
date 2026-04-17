import { IsInt, Min } from 'class-validator';

export class UpdatePublicBookingSettingsDto {
  @IsInt()
  @Min(0)
  depositAmount!: number;
}
