import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlaySession } from './entities/play-session.entity';
import { PlaySessionPlayer } from './entities/play-session-player.entity';
import { PlaySessionMatch } from './entities/play-session-match.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddPlayerDto } from './dto/add-player.dto';
import { StartMatchDto } from './dto/start-match.dto';
import { UpdateScoreDto } from './dto/update-score.dto';

type SuggestionReason = { type: 'success' | 'warning' | 'info'; text: string };
type TeamOption = {
  teamA: PlaySessionPlayer[];
  teamB: PlaySessionPlayer[];
  skillDiff: number;
  reasons: SuggestionReason[];
};
type PairingSuggestion = {
  court: number;
  options: TeamOption[];
};

const SKILL_VALUE: Record<string, number> = {
  TB: 1,
  TB_PLUS: 2,
  KHA: 3,
  GIOI: 4,
};

@Injectable()
export class PlaySessionsService {
  private readonly logger = new Logger(PlaySessionsService.name);

  constructor(
    @InjectRepository(PlaySession)
    private readonly sessionRepo: Repository<PlaySession>,
    @InjectRepository(PlaySessionPlayer)
    private readonly playerRepo: Repository<PlaySessionPlayer>,
    @InjectRepository(PlaySessionMatch)
    private readonly matchRepo: Repository<PlaySessionMatch>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  private mapBookingSkillLevel(level: string): string {
    // Legacy values from old 3-level system
    if (level === 'ADVANCED') return 'TUYEN';
    if (level === 'INTERMEDIATE') return 'KHA';
    if (level === 'BEGINNER') return 'TB';
    return level;
  }

  async findBookingSlots(date: string) {
    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.court', 'court')
      .where('b.bookingDate = :date', { date })
      .andWhere("b.status != 'CANCELLED'")
      .andWhere('b.depositPaid = true')
      .getMany();

    const slotMap = new Map<string, {
      startTime: string;
      endTime: string;
      courts: Set<string>;
      totalBookings: number;
      checkedInCount: number;
      unassignedCount: number;
    }>();

    for (const b of bookings) {
      const key = `${b.startTime}|${b.endTime}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          startTime: b.startTime,
          endTime: b.endTime,
          courts: new Set(),
          totalBookings: 0,
          checkedInCount: 0,
          unassignedCount: 0,
        });
      }
      const slot = slotMap.get(key)!;
      slot.totalBookings++;
      if (b.court) slot.courts.add(b.court.name);
      else slot.unassignedCount++;
      if (b.status === 'CHECKED_IN') slot.checkedInCount++;
    }

    const sessions = await this.sessionRepo.find({ where: { date } });
    const sessionMap = new Map<string, number>();
    for (const s of sessions) {
      sessionMap.set(`${s.startTime}|${s.endTime}`, s.id);
    }

    return Array.from(slotMap.values())
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((slot) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        courts: Array.from(slot.courts).sort(),
        totalBookings: slot.totalBookings,
        checkedInCount: slot.checkedInCount,
        unassignedCount: slot.unassignedCount,
        existingSessionId: sessionMap.get(`${slot.startTime}|${slot.endTime}`) ?? null,
      }));
  }

  async findSlotBookings(date: string, startTime: string, endTime: string) {
    return this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.court', 'court')
      .where('b.bookingDate = :date', { date })
      .andWhere('b.startTime = :startTime', { startTime })
      .andWhere('b.endTime = :endTime', { endTime })
      .andWhere("b.status != 'CANCELLED'")
      .orderBy('b.id', 'ASC')
      .getMany();
  }

  async createFromBookingSlot(date: string, startTime: string, endTime: string, numberOfCourts?: number) {
    const existing = await this.sessionRepo.findOne({
      where: { date, startTime, endTime },
      relations: ['players', 'matches'],
    });
    if (existing) {
      const bookingsForSlot = await this.bookingRepo
        .createQueryBuilder('b')
        .where('b.bookingDate = :date', { date })
        .andWhere('b.startTime = :startTime', { startTime })
        .andWhere('b.endTime = :endTime', { endTime })
        .andWhere("b.status != 'CANCELLED'")
        .getCount();
      const hasLegacyPlayers = existing.players.some((player) => player.bookingId == null);
      const bookingLinkedCount = existing.players.filter((p) => p.bookingId != null).length;
      if (existing.status !== 'ACTIVE' && (hasLegacyPlayers || bookingLinkedCount !== bookingsForSlot)) {
        await this.rebuildPlayersFromBookings(existing.id, date, startTime, endTime);
      }
      return this.findOne(existing.id);
    }

    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.court', 'court')
      .where('b.bookingDate = :date', { date })
      .andWhere('b.startTime = :startTime', { startTime })
      .andWhere('b.endTime = :endTime', { endTime })
      .andWhere("b.status != 'CANCELLED'")
      .orderBy('b.id', 'ASC')
      .getMany();

    const courtNames = [...new Set(bookings.filter((b) => b.court).map((b) => b.court!.name))];

    const session = this.sessionRepo.create({
      name: `Buổi ${startTime}–${endTime}`,
      venue: '',
      date,
      startTime,
      endTime,
      numberOfCourts: numberOfCourts ?? Math.max(courtNames.length, 1),
      status: 'UPCOMING',
    });
    const saved = await this.sessionRepo.save(session);

    for (const booking of bookings) {
      const player = this.playerRepo.create({
        sessionId: saved.id,
        bookingId: booking.id,
        name: booking.customerName,
        skillLevel: this.mapBookingSkillLevel(booking.skillLevel) as any,
        isCheckedIn: booking.status === 'CHECKED_IN',
        checkedInAt: booking.status === 'CHECKED_IN'
          ? new Date(booking.checkInAt ?? new Date().toISOString())
          : null,
      });
      await this.playerRepo.save(player);
    }

    return this.findOne(saved.id);
  }

  async findAll() {
    const sessions = await this.sessionRepo.find({
      relations: ['players', 'matches'],
      order: { createdAt: 'DESC' },
    });
    return sessions.map((s) => ({ ...s, suggestions: [] as PairingSuggestion[] }));
  }

  async findOne(id: number) {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['players', 'matches'],
      order: { players: { createdAt: 'ASC' }, matches: { startedAt: 'ASC' } },
    });
    if (!session) throw new NotFoundException(`Buổi chơi #${id} không tồn tại`);
    const suggestions =
      session.status === 'ACTIVE' ? this.generateSuggestions(session) : [];
    return { ...session, suggestions };
  }

  async create(dto: CreateSessionDto) {
    const session = this.sessionRepo.create({
      name: dto.name,
      venue: dto.venue ?? '',
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      numberOfCourts: dto.numberOfCourts,
      status: 'UPCOMING',
    });
    const saved = await this.sessionRepo.save(session);
    return this.findOne(saved.id);
  }

  async updateCourts(id: number, numberOfCourts: number) {
    if (numberOfCourts < 1)
      throw new BadRequestException('Phải có ít nhất 1 sân');
    const session = await this.sessionRepo.findOneBy({ id });
    if (!session) throw new NotFoundException(`Buổi chơi #${id} không tồn tại`);
    if (session.status === 'ENDED')
      throw new BadRequestException('Không thể thay đổi số sân của buổi đã kết thúc');
    session.numberOfCourts = numberOfCourts;
    await this.sessionRepo.save(session);
    return this.findOne(id);
  }

  async updateStatus(id: number, status: 'ACTIVE' | 'ENDED') {
    const session = await this.sessionRepo.findOneBy({ id });
    if (!session) throw new NotFoundException(`Buổi chơi #${id} không tồn tại`);

    if (status === 'ACTIVE') {
      const checkedIn = await this.playerRepo.count({
        where: { sessionId: id, isCheckedIn: true },
      });
      if (checkedIn < 4)
        throw new BadRequestException(
          'Cần ít nhất 4 người đã check-in để bắt đầu buổi chơi.',
        );
      session.startedAt = new Date();
    }

    session.status = status;
    await this.sessionRepo.save(session);
    return this.findOne(id);
  }

  async addPlayer(sessionId: number, dto: AddPlayerDto) {
    const session = await this.sessionRepo.findOneBy({ id: sessionId });
    if (!session) throw new NotFoundException(`Buổi chơi #${sessionId} không tồn tại`);

    const player = this.playerRepo.create({
      sessionId,
      name: dto.name.trim(),
      skillLevel: dto.skillLevel,
    });
    await this.playerRepo.save(player);
    return this.findOne(sessionId);
  }

  async removePlayer(sessionId: number, playerId: number) {
    const player = await this.playerRepo.findOneBy({
      id: playerId,
      sessionId,
    });
    if (!player) throw new NotFoundException('Không tìm thấy người chơi');
    if (player.isCurrentlyPlaying)
      throw new BadRequestException('Không thể xoá người đang chơi trận');
    await this.playerRepo.remove(player);
    return this.findOne(sessionId);
  }

  async checkInPlayer(sessionId: number, playerId: number) {
    const player = await this.playerRepo.findOneBy({
      id: playerId,
      sessionId,
    });
    if (!player) throw new NotFoundException('Không tìm thấy người chơi');
    player.isCheckedIn = !player.isCheckedIn;
    player.checkedInAt = player.isCheckedIn ? new Date() : null;
    await this.playerRepo.save(player);

    if (player.bookingId) {
      const booking = await this.bookingRepo.findOneBy({ id: player.bookingId });
      if (booking) {
        if (player.isCheckedIn) {
          booking.status = BookingStatus.CHECKED_IN;
          booking.checkInAt = player.checkedInAt?.toISOString() ?? new Date().toISOString();
        } else {
          booking.status = BookingStatus.CONFIRMED;
          booking.checkInAt = undefined;
        }
        await this.bookingRepo.save(booking);
      }
    }

    return this.findOne(sessionId);
  }

  private async rebuildPlayersFromBookings(
    sessionId: number,
    date: string,
    startTime: string,
    endTime: string,
  ) {
    const bookings = await this.bookingRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.court', 'court')
      .where('b.bookingDate = :date', { date })
      .andWhere('b.startTime = :startTime', { startTime })
      .andWhere('b.endTime = :endTime', { endTime })
      .andWhere("b.status != 'CANCELLED'")
      .orderBy('b.id', 'ASC')
      .getMany();

    await this.playerRepo
      .createQueryBuilder()
      .delete()
      .from(PlaySessionPlayer)
      .where('sessionId = :sessionId', { sessionId })
      .andWhere('bookingId IS NOT NULL')
      .execute();

    const players = bookings.map((booking) =>
      this.playerRepo.create({
        sessionId,
        bookingId: booking.id,
        name: booking.customerName,
        skillLevel: this.mapBookingSkillLevel(booking.skillLevel) as any,
        isCheckedIn: booking.status === 'CHECKED_IN',
        checkedInAt: booking.status === 'CHECKED_IN'
          ? new Date(booking.checkInAt ?? new Date().toISOString())
          : null,
      }),
    );

    if (players.length > 0) {
      await this.playerRepo.save(players);
    }
  }

  async startMatch(sessionId: number, dto: StartMatchDto) {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['players', 'matches'],
    });
    if (!session) throw new NotFoundException(`Buổi chơi #${sessionId} không tồn tại`);
    if (session.status !== 'ACTIVE')
      throw new BadRequestException('Buổi chơi chưa bắt đầu.');

    const playerIds = [
      dto.teamAPlayer1Id,
      dto.teamAPlayer2Id,
      dto.teamBPlayer1Id,
      dto.teamBPlayer2Id,
    ];

    const players = session.players.filter((p) => playerIds.includes(p.id));
    if (players.length !== 4)
      throw new BadRequestException('Không tìm thấy đủ 4 người chơi trong buổi này');

    const alreadyPlaying = players.filter((p) => p.isCurrentlyPlaying);
    if (alreadyPlaying.length > 0)
      throw new BadRequestException(
        `${alreadyPlaying[0].name} đang ở trận khác`,
      );

    const busyCourt = session.matches.find(
      (m) => m.courtNumber === dto.courtNumber && m.status === 'PLAYING',
    );
    if (busyCourt)
      throw new BadRequestException(`Sân ${dto.courtNumber} đang có trận đấu`);

    const match = this.matchRepo.create({
      sessionId,
      courtNumber: dto.courtNumber,
      teamAPlayer1Id: dto.teamAPlayer1Id,
      teamAPlayer2Id: dto.teamAPlayer2Id,
      teamBPlayer1Id: dto.teamBPlayer1Id,
      teamBPlayer2Id: dto.teamBPlayer2Id,
      startedAt: new Date(),
      status: 'PLAYING',
    });
    await this.matchRepo.save(match);

    await this.playerRepo.update(
      { id: In(playerIds) },
      { isCurrentlyPlaying: true },
    );

    return this.findOne(sessionId);
  }

  async updateScore(sessionId: number, matchId: number, dto: UpdateScoreDto) {
    const match = await this.matchRepo.findOneBy({ id: matchId, sessionId });
    if (!match || match.status !== 'PLAYING')
      throw new BadRequestException('Trận đấu không hợp lệ hoặc đã kết thúc');
    match.scoreA = dto.scoreA;
    match.scoreB = dto.scoreB;
    await this.matchRepo.save(match);
    return this.findOne(sessionId);
  }

  async endMatch(sessionId: number, matchId: number) {
    const match = await this.matchRepo.findOneBy({ id: matchId, sessionId });
    if (!match || match.status !== 'PLAYING')
      throw new BadRequestException('Trận đấu không hợp lệ hoặc đã kết thúc');

    const now = new Date();
    match.status = 'ENDED';
    match.endedAt = now;
    await this.matchRepo.save(match);

    const playingPlayerIds = [
      match.teamAPlayer1Id,
      match.teamAPlayer2Id,
      match.teamBPlayer1Id,
      match.teamBPlayer2Id,
    ];

    // Increment stats for players in the match
    for (const pid of playingPlayerIds) {
      await this.playerRepo.increment({ id: pid }, 'matchesPlayed', 1);
      await this.playerRepo.increment({ id: pid }, 'consecutiveMatches', 1);
    }
    await this.playerRepo.update(
      { id: In(playingPlayerIds) },
      { isCurrentlyPlaying: false, lastMatchEndedAt: now },
    );

    // Reset consecutive streak for checked-in players who are sitting out
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['players'],
    });
    if (session) {
      const sittingOut = session.players
        .filter((p) => p.isCheckedIn && !playingPlayerIds.includes(p.id))
        .map((p) => p.id);
      if (sittingOut.length > 0) {
        await this.playerRepo.update(
          { id: In(sittingOut) },
          { consecutiveMatches: 0 },
        );
      }
    }

    return this.findOne(sessionId);
  }

  // ── Auto-end past sessions ────────────────────────────────────────────────

  @Cron('0 0 * * *')
  async autoEndPastSessions() {
    const sessions = await this.sessionRepo.find({
      where: [{ status: 'UPCOMING' }, { status: 'ACTIVE' }],
    });

    const now = new Date();
    const toEnd = sessions.filter((s) => {
      const end = new Date(`${s.date}T${s.endTime}`);
      return end <= now;
    });

    if (toEnd.length === 0) return;

    await this.sessionRepo.update(
      toEnd.map((s) => s.id),
      { status: 'ENDED' },
    );
    this.logger.log(`Auto-ended ${toEnd.length} past session(s): ${toEnd.map((s) => s.id).join(', ')}`);
  }

  // ── Pairing algorithm ──────────────────────────────────────────────────────

  private generateSuggestions(session: PlaySession): PairingSuggestion[] {
    const now = new Date();
    const sessionStart = session.createdAt;

    const activeMatches = session.matches.filter((m) => m.status === 'PLAYING');
    const busyCourts = new Set(activeMatches.map((m) => m.courtNumber));
    const freeCourts = Array.from(
      { length: session.numberOfCourts },
      (_, i) => i + 1,
    ).filter((c) => !busyCourts.has(c));

    const available = session.players.filter(
      (p) => p.isCheckedIn && !p.isCurrentlyPlaying,
    );

    const suggestions: PairingSuggestion[] = [];
    const usedIds = new Set<number>();

    for (const court of freeCourts) {
      const pool = available
        .filter((p) => !usedIds.has(p.id))
        .sort((a, b) => {
          const waitA =
            now.getTime() -
            (a.lastMatchEndedAt?.getTime() ?? sessionStart.getTime());
          const waitB =
            now.getTime() -
            (b.lastMatchEndedAt?.getTime() ?? sessionStart.getTime());
          const diff = waitB - waitA;
          if (Math.abs(diff) > 30_000) return diff;
          return a.matchesPlayed - b.matchesPlayed;
        });

      if (pool.length < 4) break;

      const candidates = pool.slice(0, Math.min(6, pool.length));
      let bestFour: PlaySessionPlayer[] | null = null;
      let bestScore = Infinity;

      for (let i = 0; i < candidates.length - 3; i++) {
        for (let j = i + 1; j < candidates.length - 2; j++) {
          for (let k = j + 1; k < candidates.length - 1; k++) {
            for (let l = k + 1; l < candidates.length; l++) {
              const four = [
                candidates[i],
                candidates[j],
                candidates[k],
                candidates[l],
              ];
              const { skillDiff } = this.bestSplit(four);
              const consecutivePenalty = four.reduce(
                (s, p) => s + Math.max(0, p.consecutiveMatches - 1) * 0.4,
                0,
              );
              const orderBonus = (i + j + k + l) * 0.01;
              const score = skillDiff * 2 + consecutivePenalty + orderBonus;
              if (score < bestScore) {
                bestScore = score;
                bestFour = four;
              }
            }
          }
        }
      }

      if (!bestFour) break;

      const options = this.allThreeSplits(bestFour, now, sessionStart);
      suggestions.push({ court, options });
      bestFour.forEach((p) => usedIds.add(p.id));
    }

    return suggestions;
  }

  private allThreeSplits(
    four: PlaySessionPlayer[],
    now: Date,
    sessionStart: Date,
  ): TeamOption[] {
    const splits: [number[], number[]][] = [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2],
        [1, 3],
      ],
      [
        [0, 3],
        [1, 2],
      ],
    ];

    return splits
      .map(([ai, bi]) => {
        const teamA = ai.map((i) => four[i]);
        const teamB = bi.map((i) => four[i]);
        const avgA =
          (SKILL_VALUE[teamA[0].skillLevel] +
            SKILL_VALUE[teamA[1].skillLevel]) /
          2;
        const avgB =
          (SKILL_VALUE[teamB[0].skillLevel] +
            SKILL_VALUE[teamB[1].skillLevel]) /
          2;
        const skillDiff = Math.abs(avgA - avgB);
        const reasons = this.buildReasons(four, skillDiff, now, sessionStart);
        return { teamA, teamB, skillDiff, reasons };
      })
      .sort((a, b) => a.skillDiff - b.skillDiff);
  }

  private bestSplit(four: PlaySessionPlayer[]): { skillDiff: number } {
    const splits = [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2],
        [1, 3],
      ],
      [
        [0, 3],
        [1, 2],
      ],
    ];
    let best = Infinity;
    for (const [ai, bi] of splits) {
      const avgA =
        (SKILL_VALUE[four[ai[0]].skillLevel] +
          SKILL_VALUE[four[ai[1]].skillLevel]) /
        2;
      const avgB =
        (SKILL_VALUE[four[bi[0]].skillLevel] +
          SKILL_VALUE[four[bi[1]].skillLevel]) /
        2;
      const d = Math.abs(avgA - avgB);
      if (d < best) best = d;
    }
    return { skillDiff: best };
  }

  private buildReasons(
    four: PlaySessionPlayer[],
    skillDiff: number,
    now: Date,
    sessionStart: Date,
  ): SuggestionReason[] {
    const reasons: SuggestionReason[] = [];

    if (skillDiff === 0) reasons.push({ type: 'success', text: 'Cân bằng trình độ' });
    else if (skillDiff <= 1) reasons.push({ type: 'info', text: 'Trình độ gần tương đương' });

    const maxM = Math.max(...four.map((p) => p.matchesPlayed));
    const minM = Math.min(...four.map((p) => p.matchesPlayed));
    if (maxM - minM <= 1) reasons.push({ type: 'success', text: 'Đều lượt đánh' });

    for (const p of four) {
      if (p.consecutiveMatches >= 2)
        reasons.push({
          type: 'warning',
          text: `${p.name} đã đánh ${p.consecutiveMatches} trận liên tiếp`,
        });
    }

    const waiter = four.reduce((max, p) => {
      const wa =
        now.getTime() - (p.lastMatchEndedAt?.getTime() ?? sessionStart.getTime());
      const wb =
        now.getTime() - (max.lastMatchEndedAt?.getTime() ?? sessionStart.getTime());
      return wa > wb ? p : max;
    });
    const waitMin = Math.floor(
      (now.getTime() - (waiter.lastMatchEndedAt?.getTime() ?? sessionStart.getTime())) /
        60_000,
    );
    if (waitMin > 0)
      reasons.push({ type: 'info', text: `${waiter.name} đã chờ ${waitMin} phút` });

    return reasons;
  }
}
