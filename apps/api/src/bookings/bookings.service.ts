import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CourtsService } from '../courts/courts.service';
import { AssignCourtDto } from './dto/assign-court.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { UpdateMatchTrackingDto } from './dto/update-match-tracking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly courtsService: CourtsService,
  ) {}

  findAll() {
    return this.bookingsRepository.find({
      order: {
        bookingDate: 'DESC',
        startTime: 'ASC',
      },
    });
  }

  async create(createBookingDto: CreateBookingDto) {
    this.validateTimeRange(createBookingDto.startTime, createBookingDto.endTime);

    const booking = this.bookingsRepository.create({
      customerName: createBookingDto.customerName,
      customerPhone: createBookingDto.customerPhone,
      gender: createBookingDto.gender,
      skillLevel: createBookingDto.skillLevel,
      bookingDate: createBookingDto.bookingDate,
      startTime: createBookingDto.startTime,
      endTime: createBookingDto.endTime,
      depositAmount: createBookingDto.depositAmount,
      depositPaid: createBookingDto.depositAmount > 0,
      notes: createBookingDto.notes ?? '',
      status: BookingStatus.CONFIRMED,
      court: null,
      matchTracking: Array(7).fill(false),
    });

    return this.bookingsRepository.save(booking);
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

    if (booking.status === BookingStatus.PENDING) {
      booking.status = BookingStatus.CONFIRMED;
    }

    return this.bookingsRepository.save(booking);
  }

  async checkIn(id: number) {
    const booking = await this.findById(id);

    if (!booking.court) {
      throw new BadRequestException('A court must be assigned before check-in.');
    }

    if (booking.depositAmount > 0 && !booking.depositPaid) {
      throw new BadRequestException(
        'Deposit must be marked as paid before check-in.',
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
        'Full payment can only be confirmed after the game has started and been checked in.',
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
        'Only customers with a paid deposit can be marked as not showing.',
      );
    }

    if (booking.status === BookingStatus.CHECKED_IN || booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Checked-in or completed bookings cannot be marked as not showing.');
    }

    booking.status = BookingStatus.NO_SHOW;
    return this.bookingsRepository.save(booking);
  }

  async updateMatchTracking(id: number, updateMatchTrackingDto: UpdateMatchTrackingDto) {
    const booking = await this.findById(id);

    if (!booking.court) {
      throw new BadRequestException('A court must be assigned before tracking matches.');
    }

    const matchTracking = [...(booking.matchTracking ?? Array(7).fill(false))];
    matchTracking[updateMatchTrackingDto.slot] = updateMatchTrackingDto.checked;
    booking.matchTracking = matchTracking;

    return this.bookingsRepository.save(booking);
  }

  async remove(id: number) {
    const booking = await this.findById(id);
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

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('End time must be later than start time.');
    }
  }
}
