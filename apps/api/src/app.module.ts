import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from './bookings/entities/booking.entity';
import { BookingsModule } from './bookings/bookings.module';
import { Court } from './courts/entities/court.entity';
import { CourtsModule } from './courts/courts.module';
import { EquipmentItem } from './equipment/entities/equipment-item.entity';
import { EquipmentModule } from './equipment/equipment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SeedModule } from './seed/seed.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>(
          'DATABASE_URL',
          'postgresql://postgres:postgres@localhost:5432/badminton_court',
        ),
        entities: [Booking, Court, EquipmentItem],
        synchronize: true,
      }),
    }),
    CourtsModule,
    EquipmentModule,
    BookingsModule,
    DashboardModule,
    SeedModule,
  ],
})
export class AppModule {}
