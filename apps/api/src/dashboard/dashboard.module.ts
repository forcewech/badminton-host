import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { Court } from '../courts/entities/court.entity';
import { EquipmentItem } from '../equipment/entities/equipment-item.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, Court, EquipmentItem])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
