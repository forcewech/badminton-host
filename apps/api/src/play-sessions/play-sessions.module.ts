import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaySession } from './entities/play-session.entity';
import { PlaySessionPlayer } from './entities/play-session-player.entity';
import { PlaySessionMatch } from './entities/play-session-match.entity';
import { PlaySessionsService } from './play-sessions.service';
import { PlaySessionsController } from './play-sessions.controller';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaySession, PlaySessionPlayer, PlaySessionMatch, Booking]),
  ],
  controllers: [PlaySessionsController],
  providers: [PlaySessionsService],
})
export class PlaySessionsModule {}
