import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsModule } from '../courts/courts.module';
import { CloudinaryService } from './cloudinary.service';
import { Booking } from './entities/booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PaymentController } from './payment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), CourtsModule],
  controllers: [BookingsController, PaymentController],
  providers: [BookingsService, CloudinaryService],
  exports: [BookingsService],
})
export class BookingsModule {}
