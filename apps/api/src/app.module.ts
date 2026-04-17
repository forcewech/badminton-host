import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { Booking } from './bookings/entities/booking.entity';
import { BookingsModule } from './bookings/bookings.module';
import { Court } from './courts/entities/court.entity';
import { CourtsModule } from './courts/courts.module';
import { EquipmentItem } from './equipment/entities/equipment-item.entity';
import { EquipmentModule } from './equipment/equipment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { QuickSlot } from './quick-slots/entities/quick-slot.entity';
import { QuickSlotsModule } from './quick-slots/quick-slots.module';
import { SeedModule } from './seed/seed.module';
import { AppSetting } from './settings/entities/app-setting.entity';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL', '');
        const sslEnabled =
          configService.get<string>('DATABASE_SSL', 'true') === 'true';
        const rejectUnauthorized =
          configService.get<string>(
            'DATABASE_SSL_REJECT_UNAUTHORIZED',
            'false',
          ) === 'true';
        const synchronize =
          configService.get<string>('TYPEORM_SYNCHRONIZE', 'true') === 'true';

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          ssl: sslEnabled ? { rejectUnauthorized } : false,
          entities: [AppSetting, Booking, Court, EquipmentItem, QuickSlot],
          synchronize,
        };
      },
    }),
    AuthModule,
    CourtsModule,
    EquipmentModule,
    BookingsModule,
    DashboardModule,
    QuickSlotsModule,
    SettingsModule,
    SeedModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
