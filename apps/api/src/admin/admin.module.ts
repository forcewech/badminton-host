import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { QuickSlot } from '../quick-slots/entities/quick-slot.entity';
import { PlaySession } from '../play-sessions/entities/play-session.entity';
import { PlaySessionPlayer } from '../play-sessions/entities/play-session-player.entity';
import { PlaySessionMatch } from '../play-sessions/entities/play-session-match.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, QuickSlot, PlaySession, PlaySessionPlayer, PlaySessionMatch]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
