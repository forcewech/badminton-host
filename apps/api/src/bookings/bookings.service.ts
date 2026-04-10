import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BookingStatus } from "../common/enums/booking-status.enum";
import { CourtsService } from "../courts/courts.service";
import { AssignCourtDto } from "./dto/assign-court.dto";
import { CreateBookingDto } from "./dto/create-booking.dto";
import { CreatePublicBookingDto } from "./dto/create-public-booking.dto";
import { Booking } from "./entities/booking.entity";
import { UpdateMatchTrackingDto } from "./dto/update-match-tracking.dto";
import { CloudinaryService } from "./cloudinary.service";

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly courtsService: CourtsService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  findAll() {
    return this.bookingsRepository.find({
      order: {
        bookingDate: "DESC",
        startTime: "ASC",
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
    return this.ensureDepositReference(savedBooking);
  }

  async createPublic(createPublicBookingDto: CreatePublicBookingDto) {
    this.validateTimeRange(
      createPublicBookingDto.startTime,
      createPublicBookingDto.endTime,
    );

    const booking = this.bookingsRepository.create({
      customerName: createPublicBookingDto.customerName,
      customerPhone: createPublicBookingDto.customerPhone?.trim() ?? "",
      gender: createPublicBookingDto.gender,
      skillLevel: createPublicBookingDto.skillLevel,
      bookingDate: createPublicBookingDto.bookingDate,
      startTime: createPublicBookingDto.startTime,
      endTime: createPublicBookingDto.endTime,
      depositAmount: this.getDefaultDepositAmount(),
      depositPaid: false,
      notes: createPublicBookingDto.notes ?? "",
      photoUrl: createPublicBookingDto.photoUrl ?? null,
      photoPublicId: createPublicBookingDto.photoPublicId ?? null,
      status: BookingStatus.PENDING,
      court: null,
      matchTracking: Array(7).fill(false),
    });

    const savedBooking = await this.bookingsRepository.save(booking);
    const bookingWithReference =
      await this.ensureDepositReference(savedBooking);

    return {
      booking: bookingWithReference,
      payment: this.buildDepositPaymentInfo(bookingWithReference),
    };
  }

  async assignCourt(id: number, assignCourtDto: AssignCourtDto) {
    const booking = await this.findById(id);
    const court = await this.courtsService.findOne(assignCourtDto.courtId);

    booking.court = court;

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
    return {
      reference: booking.depositReference,
      depositAmount: Number(booking.depositAmount),
      depositPaid: booking.depositPaid,
      depositPaidAt: booking.depositPaidAt ?? null,
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
    if (!transaction.reference) {
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
      return {
        received: true,
        matched: false,
        reason: `No booking found for reference ${transaction.reference}.`,
      };
    }

    const expectedAmount = Number(booking.depositAmount);
    if (
      transaction.amount !== null &&
      expectedAmount > 0 &&
      transaction.amount < expectedAmount
    ) {
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

    if (!booking.court) {
      throw new BadRequestException(
        "A court must be assigned before check-in.",
      );
    }

    if (booking.depositAmount > 0 && !booking.depositPaid) {
      throw new BadRequestException(
        "Deposit must be marked as paid before check-in.",
      );
    }

    booking.status = BookingStatus.CHECKED_IN;
    booking.checkInAt = new Date().toISOString();

    return this.bookingsRepository.save(booking);
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

  async remove(id: number) {
    const booking = await this.findById(id);

    if (booking.photoPublicId) {
      await this.cloudinaryService.deleteCustomerPhoto(booking.photoPublicId);
    }

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

  private getDefaultDepositAmount() {
    const configuredAmount = Number(
      this.configService.get<string>("CUSTOMER_DEPOSIT_AMOUNT", "30000"),
    );

    return Number.isFinite(configuredAmount) && configuredAmount >= 0
      ? configuredAmount
      : 30000;
  }

  private getDepositReferencePrefix() {
    return this.configService
      .get<string>("DEPOSIT_REFERENCE_PREFIX", "BDC")
      .trim()
      .toUpperCase();
  }

  private buildDepositPaymentInfo(booking: Booking) {
    const bankBin = this.configService.get<string>("BANK_BIN", "970416");
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
    };
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
