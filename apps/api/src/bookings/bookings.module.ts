import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsModule } from '../courts/courts.module';
import { Booking } from './entities/booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), CourtsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
