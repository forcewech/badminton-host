import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Not, Repository } from "typeorm";
import { BookingStatus } from "../common/enums/booking-status.enum";
import { CourtsService } from "../courts/courts.service";
import { AssignCourtDto } from "./dto/assign-court.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { CreatePublicBookingDto } from "./dto/create-public-booking.dto";
import { Booking } from "./entities/booking.entity";
import { UpdateMatchTrackingDto } from "./dto/update-match-tracking.dto";
import { UpdateBookingDto } from "./dto/update-booking.dto";
import { CloudinaryService } from "./cloudinary.service";
import { SettingsService } from "../settings/settings.service";
import { PlaySession } from "../play-sessions/entities/play-session.entity";
import { PlaySessionPlayer } from "../play-sessions/entities/play-session-player.entity";
import { QuickSlot } from "../quick-slots/entities/quick-slot.entity";

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(PlaySession)
    private readonly sessionRepository: Repository<PlaySession>,
    @InjectRepository(PlaySessionPlayer)
    private readonly sessionPlayerRepository: Repository<PlaySessionPlayer>,
    private readonly courtsService: CourtsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findAll() {
    return this.bookingsRepository.find({
      order: {
        createdAt: "DESC",
      },
    });
  }

  async create(createBookingDto: CreateBookingDto) {
    this.validateTimeRange(
      createBookingDto.startTime,
      createBookingDto.endTime,
    );

    const booking = this.bookingsRepository.create({
      customerName: createBookingDto.customerName,
      customerPhone: createBookingDto.customerPhone?.trim() ?? "",
      gender: createBookingDto.gender,
      skillLevel: createBookingDto.skillLevel,
      bookingDate: createBookingDto.bookingDate,
      startTime: createBookingDto.startTime,
      endTime: createBookingDto.endTime,
      depositAmount: createBookingDto.depositAmount,
      depositPaid: createBookingDto.depositAmount > 0,
      notes: createBookingDto.notes ?? "",
      photoUrl: createBookingDto.photoUrl ?? null,
      photoPublicId: createBookingDto.photoPublicId ?? null,
      status: BookingStatus.CONFIRMED,
      court: null,
      matchTracking: Array(7).fill(false),
    });

    const savedBooking = await this.bookingsRepository.save(booking);
    await this.syncSessionPlayerFromBooking(savedBooking);
    return this.ensureDepositReference(savedBooking);
  }

  async createPublic(createPublicBookingDto: CreatePublicBookingDto) {
    this.validateTimeRange(
      createPublicBookingDto.startTime,
      createPublicBookingDto.endTime,
    );

    const depositAmount = await this.getDefaultDepositAmount();
    const depositExpiresAt = this.getDepositExpiryIso();

    const savedBooking = await this.dataSource.transaction(
      "SERIALIZABLE",
      async (manager) => {
        const slot = await manager.findOne(QuickSlot, {
          where: {
            bookingDate: createPublicBookingDto.bookingDate,
            startTime: createPublicBookingDto.startTime,
            endTime: createPublicBookingDto.endTime,
          },
        });

        if (slot) {
          const currentBookings = await manager.count(Booking, {
            where: {
              bookingDate: createPublicBookingDto.bookingDate,
              startTime: createPublicBookingDto.startTime,
              endTime: createPublicBookingDto.endTime,
              status: Not(BookingStatus.CANCELLED),
            },
          });

          if (currentBookings >= slot.maxPlayers) {
            throw new ConflictException(
              "Khung giờ này vừa được đặt hết. Vui lòng chọn khung giờ khác.",
            );
          }
        }

        const booking = manager.create(Booking, {
          customerName: createPublicBookingDto.customerName,
          customerPhone: createPublicBookingDto.customerPhone?.trim() ?? "",
          gender: createPublicBookingDto.gender,
          skillLevel: createPublicBookingDto.skillLevel,
          bookingDate: createPublicBookingDto.bookingDate,
          startTime: createPublicBookingDto.startTime,
          endTime: createPublicBookingDto.endTime,
          depositAmount,
          depositPaid: false,
          depositExpiresAt,
          notes: createPublicBookingDto.notes ?? "",
          photoUrl: createPublicBookingDto.photoUrl ?? null,
          photoPublicId: createPublicBookingDto.photoPublicId ?? null,
          status: BookingStatus.PENDING,
          court: null,
          matchTracking: Array(7).fill(false),
        });

        return manager.save(booking);
      },
    );

    await this.syncSessionPlayerFromBooking(savedBooking);
    const bookingWithReference =
      await this.ensureDepositReference(savedBooking);

    return {
      booking: bookingWithReference,
      payment: this.buildDepositPaymentInfo(bookingWithReference),
    };
  }

  async assignCourt(id: number, assignCourtDto: AssignCourtDto) {
    const booking = await this.findById(id);

    if (assignCourtDto.courtId == null) {
      booking.court = null;
    } else {
      booking.court = await this.courtsService.findOne(assignCourtDto.courtId);
    }

    return this.bookingsRepository.save(booking);
  }

  async confirmDeposit(id: number) {
    const booking = await this.findById(id);
    booking.depositPaid = true;
    booking.depositPaidAt = new Date().toISOString();

    if (booking.status === BookingStatus.PENDING) {
      booking.status = BookingStatus.CONFIRMED;
    }

    return this.bookingsRepository.save(booking);
  }

  async getPublicPaymentStatus(reference: string) {
    const booking = await this.findByDepositReference(reference);
    await this.expirePendingBookingIfNeeded(booking);

    return {
      reference: booking.depositReference,
      depositAmount: Number(booking.depositAmount),
      depositPaid: booking.depositPaid,
      depositPaidAt: booking.depositPaidAt ?? null,
      depositExpiresAt: booking.depositExpiresAt ?? null,
      isExpired: this.isBookingExpired(booking),
      status: booking.status,
      customerName: booking.customerName,
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      payment: this.buildDepositPaymentInfo(booking),
    };
  }

  async processDepositWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ) {
    this.verifyWebhookSecret(payload, headers);

    const transaction = this.extractTransaction(payload);
    this.logger.log(
      `Received payment callback: transactionId=${transaction.transactionId ?? "unknown"} reference=${transaction.reference ?? "missing"} amount=${transaction.amount ?? "unknown"}`,
    );
    if (!transaction.reference) {
      this.logger.warn(
        "Payment callback ignored because no deposit reference was found.",
      );
      return {
        received: true,
        matched: false,
        reason: "No deposit reference found in webhook payload.",
      };
    }

    const booking = await this.bookingsRepository.findOne({
      where: { depositReference: transaction.reference },
    });

    if (!booking) {
      this.logger.warn(
        `Payment callback did not match any booking for reference ${transaction.reference}.`,
      );
      return {
        received: true,
        matched: false,
        reason: `No booking found for reference ${transaction.reference}.`,
      };
    }

    await this.expirePendingBookingIfNeeded(booking);

    if (booking.status === BookingStatus.CANCELLED) {
      booking.depositPaid = true;
      booking.depositPaidAt = booking.depositPaidAt ?? new Date().toISOString();
      booking.depositTransferNote = transaction.description ?? null;
      booking.depositTransactionId = transaction.transactionId ?? null;
      booking.depositReceivedWhileCancelled = true;
      await this.bookingsRepository.save(booking);

      this.logger.error(
        `[CẦN KIỂM TRA] Webhook nhận tiền cho booking ĐÃ HUỶ — ` +
          `bookingId=${booking.id} | khách=${booking.customerName} | ` +
          `reference=${transaction.reference} | ` +
          `số tiền=${transaction.amount ?? "không rõ"} VNĐ | ` +
          `hết hạn lúc=${booking.depositExpiresAt ?? "không có"}. ` +
          `Booking đã được đánh dấu "Cần xử lý" trong hệ thống.`,
      );
      return {
        received: true,
        matched: false,
        reason: "Booking has been cancelled.",
      };
    }

    if (this.isBookingExpired(booking)) {
      this.logger.error(
        `[CẦN KIỂM TRA] Webhook nhận tiền cho booking HẾT HẠN — ` +
          `bookingId=${booking.id} | khách=${booking.customerName} | ` +
          `reference=${transaction.reference} | ` +
          `số tiền=${transaction.amount ?? "không rõ"} VNĐ | ` +
          `hết hạn lúc=${booking.depositExpiresAt ?? "không có"}. ` +
          `Kiểm tra sao kê ngân hàng, có thể cần hoàn tiền thủ công.`,
      );
      return {
        received: true,
        matched: false,
        reason: "Booking has expired and is no longer valid.",
      };
    }

    const expectedAmount = Number(booking.depositAmount);
    if (
      transaction.amount !== null &&
      expectedAmount > 0 &&
      transaction.amount < expectedAmount
    ) {
      this.logger.warn(
        `Payment callback amount ${transaction.amount} is lower than expected deposit ${expectedAmount} for reference ${transaction.reference}.`,
      );
      return {
        received: true,
        matched: false,
        reason: "Transferred amount is lower than required deposit.",
      };
    }
    booking.depositPaid = true;
    booking.depositPaidAt = booking.depositPaidAt ?? new Date().toISOString();
    booking.depositTransferNote = transaction.description ?? null;
    booking.depositTransactionId = transaction.transactionId ?? null;

    if (booking.status === BookingStatus.PENDING) {
      booking.status = BookingStatus.CONFIRMED;
    }

    const savedBooking = await this.bookingsRepository.save(booking);
    await this.syncSessionPlayerFromBooking(savedBooking);
    this.logger.log(
      `Deposit confirmed for booking ${savedBooking.id} with reference ${savedBooking.depositReference}.`,
    );

    return {
      received: true,
      matched: true,
      bookingId: savedBooking.id,
      reference: savedBooking.depositReference,
      depositPaid: savedBooking.depositPaid,
    };
  }

  async checkIn(id: number) {
    const booking = await this.findById(id);

    if (booking.depositAmount > 0 && !booking.depositPaid) {
      throw new BadRequestException(
        "Deposit must be marked as paid before check-in.",
      );
    }

    booking.status = BookingStatus.CHECKED_IN;
    booking.checkInAt = new Date().toISOString();
    const savedBooking = await this.bookingsRepository.save(booking);
    await this.syncSessionPlayerFromBooking(savedBooking);
    return savedBooking;
  }

  async confirmFullPayment(id: number) {
    const booking = await this.findById(id);

    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new BadRequestException(
        "Full payment can only be confirmed after the game has started and been checked in.",
      );
    }

    booking.fullPaymentTransferred = true;
    booking.paymentTransferredAt = new Date().toISOString();
    booking.status = BookingStatus.COMPLETED;

    return this.bookingsRepository.save(booking);
  }

  async restoreCancelledBooking(id: number) {
    const booking = await this.findById(id);

    if (booking.status !== BookingStatus.CANCELLED) {
      throw new BadRequestException(
        "Chỉ có thể khôi phục booking đã bị huỷ.",
      );
    }

    booking.status = BookingStatus.CONFIRMED;
    booking.depositPaid = true;
    booking.depositReceivedWhileCancelled = false;

    this.logger.log(
      `Restored cancelled booking ${booking.id} for customer ${booking.customerName}.`,
    );
    return this.bookingsRepository.save(booking);
  }

  async markNoShow(id: number) {
    const booking = await this.findById(id);

    if (!booking.depositPaid) {
      throw new BadRequestException(
        "Only customers with a paid deposit can be marked as not showing.",
      );
    }

    if (
      booking.status === BookingStatus.CHECKED_IN ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "Checked-in or completed bookings cannot be marked as not showing.",
      );
    }

    booking.status = BookingStatus.NO_SHOW;
    return this.bookingsRepository.save(booking);
  }

  async updateMatchTracking(
    id: number,
    updateMatchTrackingDto: UpdateMatchTrackingDto,
  ) {
    const booking = await this.findById(id);

    if (!booking.court) {
      throw new BadRequestException(
        "A court must be assigned before tracking matches.",
      );
    }

    const matchTracking = [...(booking.matchTracking ?? Array(7).fill(false))];
    matchTracking[updateMatchTrackingDto.slot] = updateMatchTrackingDto.checked;
    booking.matchTracking = matchTracking;

    return this.bookingsRepository.save(booking);
  }

  async update(id: number, dto: UpdateBookingDto) {
    const booking = await this.findById(id);
    Object.assign(booking, dto);
    return this.bookingsRepository.save(booking);
  }

  async remove(id: number) {
    const booking = await this.findById(id);

    if (booking.photoPublicId) {
      await this.cloudinaryService.deleteCustomerPhoto(booking.photoPublicId);
    }

    await this.sessionPlayerRepository.delete({ bookingId: id });
    await this.bookingsRepository.remove(booking);
    return { id, deleted: true };
  }

  private async findById(id: number) {
    const booking = await this.bookingsRepository.findOne({ where: { id } });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    return booking;
  }

  private async findByDepositReference(reference: string) {
    const booking = await this.bookingsRepository.findOne({
      where: { depositReference: reference },
    });

    if (!booking) {
      throw new NotFoundException(
        `Booking with reference ${reference} not found`,
      );
    }

    return booking;
  }

  private async ensureDepositReference(booking: Booking) {
    if (booking.depositReference) {
      return booking;
    }

    booking.depositReference = `${this.getDepositReferencePrefix()}${booking.id}`;
    return this.bookingsRepository.save(booking);
  }

  private async syncSessionPlayerFromBooking(booking: Booking) {
    const players = await this.sessionPlayerRepository.find({
      where: { bookingId: booking.id },
    });

    const shouldBeInSession = booking.status !== BookingStatus.CANCELLED && booking.depositPaid;

    if (players.length === 0) {
      if (!shouldBeInSession) return;

      const session = await this.sessionRepository.findOne({
        where: {
          date: booking.bookingDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
      });
      if (!session || session.status === 'ENDED') return;

      const player = this.sessionPlayerRepository.create({
        sessionId: session.id,
        bookingId: booking.id,
        name: booking.customerName,
        skillLevel: this.mapBookingSkillLevel(booking.skillLevel) as any,
        isCheckedIn: booking.status === BookingStatus.CHECKED_IN,
        checkedInAt: booking.status === BookingStatus.CHECKED_IN
          ? new Date(booking.checkInAt ?? new Date().toISOString())
          : null,
      });
      await this.sessionPlayerRepository.save(player);
      return;
    }

    for (const player of players) {
      if (!shouldBeInSession) {
        await this.sessionPlayerRepository.remove(player);
      } else {
        player.name = booking.customerName;
        player.skillLevel = this.mapBookingSkillLevel(booking.skillLevel) as any;
        player.isCheckedIn = booking.status === BookingStatus.CHECKED_IN;
        player.checkedInAt = booking.status === BookingStatus.CHECKED_IN
          ? new Date(booking.checkInAt ?? new Date().toISOString())
          : null;
        await this.sessionPlayerRepository.save(player);
      }
    }
  }

  private mapBookingSkillLevel(level: string): string {
    // Legacy values from old 3-level system
    if (level === 'ADVANCED') return 'TUYEN';
    if (level === 'INTERMEDIATE') return 'KHA';
    if (level === 'BEGINNER') return 'TB';
    return level;
  }

  private async getDefaultDepositAmount() {
    return this.settingsService.getPublicBookingDepositAmount();
  }

  private getDepositExpirySeconds() {
    const configuredSeconds = Number(
      this.configService.get<string>("PAYMENT_EXPIRY_SECONDS", "300"),
    );

    return Number.isFinite(configuredSeconds) && configuredSeconds > 0
      ? configuredSeconds
      : 300;
  }

  private getDepositExpiryIso() {
    return new Date(
      Date.now() + this.getDepositExpirySeconds() * 1000,
    ).toISOString();
  }

  private getDepositReferencePrefix() {
    return this.configService
      .get<string>("DEPOSIT_REFERENCE_PREFIX", "BDC")
      .trim()
      .toUpperCase();
  }

  private buildDepositPaymentInfo(booking: Booking) {
    const bankBin = this.configService.get<string>("BANK_BIN", "970436");
    const accountNumber = this.configService.get<string>(
      "BANK_ACCOUNT_NUMBER",
      "",
    );
    const accountName = this.configService.get<string>("BANK_ACCOUNT_NAME", "");
    const template = this.configService.get<string>(
      "BANK_QR_TEMPLATE",
      "compact2",
    );
    const bankName = this.configService.get<string>(
      "BANK_DISPLAY_NAME",
      "Ngân hàng",
    );
    const transferContent = booking.depositReference ?? "";
    const amount = Number(booking.depositAmount);

    const qrImageUrl = accountNumber
      ? `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png?amount=${Math.round(
          amount,
        )}&addInfo=${encodeURIComponent(
          transferContent,
        )}&accountName=${encodeURIComponent(accountName)}`
      : null;

    return {
      bankName,
      bankBin,
      accountNumber,
      accountName,
      amount,
      transferContent,
      qrImageUrl,
      isConfigured: Boolean(accountNumber && accountName),
      expiresAt: booking.depositExpiresAt ?? null,
    };
  }

  private isBookingExpired(booking: Booking) {
    if (booking.depositPaid || !booking.depositExpiresAt) {
      return false;
    }

    return new Date(booking.depositExpiresAt).getTime() <= Date.now();
  }

  private async expirePendingBookingIfNeeded(booking: Booking) {
    if (
      !this.isBookingExpired(booking) ||
      booking.status !== BookingStatus.PENDING
    ) {
      return booking;
    }

    booking.status = BookingStatus.CANCELLED;
    return this.bookingsRepository.save(booking);
  }

  private verifyWebhookSecret(
    payload: Record<string, unknown>,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const expectedSecret =
      this.configService.get<string>("PAYMENT_CALLBACK_TOKEN", "") ||
      this.configService.get<string>("BANK_WEBHOOK_SECRET", "");
    if (!expectedSecret) {
      return;
    }

    const headerSecret = this.getHeaderValue(headers, [
      "x-webhook-secret",
      "x-webhook-token",
      "authorization",
    ]);
    const payloadSecret = this.findFirstString(payload, [
      "secret",
      "token",
      "webhookSecret",
    ]);
    const providedSecret = (headerSecret || payloadSecret || "").replace(
      /^Bearer\s+/i,
      "",
    );

    if (providedSecret !== expectedSecret) {
      throw new UnauthorizedException("Invalid webhook secret.");
    }
  }

  private extractTransaction(payload: Record<string, unknown>) {
    const description =
      this.findFirstString(payload, [
        "description",
        "content",
        "transferContent",
        "message",
        "remark",
        "addDescription",
      ]) ?? "";
    const transactionId = this.findFirstString(payload, [
      "transactionId",
      "transaction_id",
      "transactionCode",
      "reference",
      "txnId",
      "id",
    ]);
    const amount = this.findFirstNumber(payload, [
      "amount",
      "transferAmount",
      "creditAmount",
      "credit",
      "value",
    ]);
    const reference =
      this.extractReferenceFromText(description) ??
      this.extractReferenceFromText(
        this.findFirstString(payload, [
          "reference",
          "code",
          "orderCode",
          "transaction_id",
        ]) ?? "",
      );

    return {
      amount,
      description: description || null,
      transactionId: transactionId || null,
      reference,
    };
  }

  private extractReferenceFromText(text: string) {
    if (!text) {
      return null;
    }

    const prefix = this.getDepositReferencePrefix();
    const match = text.toUpperCase().match(new RegExp(`${prefix}\\d+`, "i"));
    return match?.[0]?.toUpperCase() ?? null;
  }

  private findFirstString(value: unknown, keys: string[]): string | null {
    const match = this.findFirstValue(value, keys);
    if (typeof match === "string") {
      return match.trim();
    }

    if (typeof match === "number") {
      return String(match);
    }

    return null;
  }

  private findFirstNumber(value: unknown, keys: string[]): number | null {
    const match = this.findFirstValue(value, keys);
    const numericValue =
      typeof match === "number"
        ? match
        : typeof match === "string"
          ? Number(match.replace(/[^\d.-]/g, ""))
          : NaN;

    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private findFirstValue(value: unknown, keys: string[]): unknown {
    if (Array.isArray(value)) {
      for (const item of value) {
        const nestedMatch = this.findFirstValue(item, keys);
        if (nestedMatch !== undefined) {
          return nestedMatch;
        }
      }

      return undefined;
    }

    if (!value || typeof value !== "object") {
      return undefined;
    }

    const record = value as Record<string, unknown>;
    for (const [recordKey, recordValue] of Object.entries(record)) {
      if (keys.some((key) => key.toLowerCase() === recordKey.toLowerCase())) {
        return recordValue;
      }

      const nestedMatch = this.findFirstValue(recordValue, keys);
      if (nestedMatch !== undefined) {
        return nestedMatch;
      }
    }

    return undefined;
  }

  private getHeaderValue(
    headers: Record<string, string | string[] | undefined>,
    keys: string[],
  ) {
    for (const key of keys) {
      const rawValue = headers[key];
      if (Array.isArray(rawValue)) {
        return rawValue[0] ?? "";
      }

      if (rawValue) {
        return rawValue;
      }
    }

    return "";
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException("End time must be later than start time.");
    }
  }
}
