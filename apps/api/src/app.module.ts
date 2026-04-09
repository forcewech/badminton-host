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
import { SeedModule } from './seed/seed.module';

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
    AuthModule,
    CourtsModule,
    EquipmentModule,
    BookingsModule,
    DashboardModule,
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
