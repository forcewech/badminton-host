import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdatePublicBookingSettingsDto } from './dto/update-public-booking-settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public-booking')
  getPublicBookingSettings() {
    return this.settingsService.getPublicBookingSettings();
  }

  @Patch('public-booking')
  updatePublicBookingSettings(
    @Body() updatePublicBookingSettingsDto: UpdatePublicBookingSettingsDto,
  ) {
    return this.settingsService.updatePublicBookingSettings(
      updatePublicBookingSettingsDto,
    );
  }
}
