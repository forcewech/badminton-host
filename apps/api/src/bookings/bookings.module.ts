import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsModule } from '../courts/courts.module';
import { CloudinaryService } from './cloudinary.service';
import { Booking } from './entities/booking.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PaymentController } from './payment.controller';
import { SettingsModule } from '../settings/settings.module';
import { PlaySession } from '../play-sessions/entities/play-session.entity';
import { PlaySessionPlayer } from '../play-sessions/entities/play-session-player.entity';
import { QuickSlot } from '../quick-slots/entities/quick-slot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, PlaySession, PlaySessionPlayer, QuickSlot]),
    CourtsModule,
    SettingsModule,
  ],
  controllers: [BookingsController, PaymentController],
  providers: [BookingsService, CloudinaryService],
  exports: [BookingsService],
})
export class BookingsModule {}
