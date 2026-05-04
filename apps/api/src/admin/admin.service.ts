import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { QuickSlot } from '../quick-slots/entities/quick-slot.entity';
import { PlaySession } from '../play-sessions/entities/play-session.entity';
import { PlaySessionPlayer } from '../play-sessions/entities/play-session-player.entity';
import { PlaySessionMatch } from '../play-sessions/entities/play-session-match.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(QuickSlot)
    private readonly quickSlotRepo: Repository<QuickSlot>,
    @InjectRepository(PlaySession)
    private readonly sessionRepo: Repository<PlaySession>,
    @InjectRepository(PlaySessionPlayer)
    private readonly playerRepo: Repository<PlaySessionPlayer>,
    @InjectRepository(PlaySessionMatch)
    private readonly matchRepo: Repository<PlaySessionMatch>,
  ) {}

  async resetPastData() {
    const today = new Date().toISOString().slice(0, 10);

    // Lấy ID các session quá khứ
    const pastSessions = await this.sessionRepo.find({
      where: { date: LessThan(today) },
      select: ['id'],
    });
    const pastSessionIds = pastSessions.map((s) => s.id);

    if (pastSessionIds.length > 0) {
      await this.matchRepo
        .createQueryBuilder()
        .delete()
        .where('sessionId IN (:...ids)', { ids: pastSessionIds })
        .execute();

      await this.playerRepo
        .createQueryBuilder()
        .delete()
        .where('sessionId IN (:...ids)', { ids: pastSessionIds })
        .execute();

      await this.sessionRepo
        .createQueryBuilder()
        .delete()
        .where('id IN (:...ids)', { ids: pastSessionIds })
        .execute();
    }

    const bookingResult = await this.bookingRepo
      .createQueryBuilder()
      .delete()
      .from(Booking)
      .where('bookingDate < :today', { today })
      .execute();

    const quickSlotResult = await this.quickSlotRepo
      .createQueryBuilder()
      .delete()
      .from(QuickSlot)
      .where('bookingDate < :today', { today })
      .execute();

    return {
      message: 'Đã xóa dữ liệu quá khứ thành công.',
      deleted: {
        sessions: pastSessionIds.length,
        bookings: bookingResult.affected ?? 0,
        quickSlots: quickSlotResult.affected ?? 0,
      },
    };
  }
}
