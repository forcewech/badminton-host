import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdatePublicBookingSettingsDto } from './dto/update-public-booking-settings.dto';
import { AppSetting } from './entities/app-setting.entity';

const PUBLIC_BOOKING_DEPOSIT_KEY = 'public_booking_deposit_amount';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepository: Repository<AppSetting>,
    private readonly configService: ConfigService,
  ) {}

  async getPublicBookingSettings() {
    return {
      depositAmount: await this.getPublicBookingDepositAmount(),
    };
  }

  async updatePublicBookingSettings(
    updatePublicBookingSettingsDto: UpdatePublicBookingSettingsDto,
  ) {
    await this.settingsRepository.save({
      key: PUBLIC_BOOKING_DEPOSIT_KEY,
      value: String(updatePublicBookingSettingsDto.depositAmount),
    });

    return this.getPublicBookingSettings();
  }

  async getPublicBookingDepositAmount() {
    const savedSetting = await this.settingsRepository.findOne({
      where: { key: PUBLIC_BOOKING_DEPOSIT_KEY },
    });

    const configuredAmount = Number(
      savedSetting?.value ??
        this.configService.get<string>('CUSTOMER_DEPOSIT_AMOUNT', '65000'),
    );

    return Number.isFinite(configuredAmount) && configuredAmount >= 0
      ? configuredAmount
      : 65000;
  }
}
