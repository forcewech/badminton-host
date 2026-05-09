import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CreateQuickSlotDto } from './dto/create-quick-slot.dto';
import { UpdateQuickSlotDto } from './dto/update-quick-slot.dto';
import { QuickSlot } from './entities/quick-slot.entity';

export type QuickSlotWithCount = QuickSlot & { currentBookings: number };

@Injectable()
export class QuickSlotsService {
  constructor(
    @InjectRepository(QuickSlot)
    private readonly quickSlotsRepository: Repository<QuickSlot>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
  ) {}

  async findByDate(bookingDate: string): Promise<QuickSlotWithCount[]> {
    if (!bookingDate) {
      throw new BadRequestException('Booking date is required.');
    }

    const slots = await this.quickSlotsRepository.find({
      where: { bookingDate },
      order: {
        startTime: 'ASC',
        endTime: 'ASC',
      },
    });

    if (slots.length === 0) return [];

    return Promise.all(
      slots.map(async (slot) => {
        const currentBookings = await this.countActiveBookings(
          slot.bookingDate,
          slot.startTime,
          slot.endTime,
        );
        return { ...slot, currentBookings };
      }),
    );
  }

  countActiveBookings(
    bookingDate: string,
    startTime: string,
    endTime: string,
  ) {
    return this.bookingsRepository.count({
      where: {
        bookingDate,
        startTime,
        endTime,
        status: Not(BookingStatus.CANCELLED),
      },
    });
  }

  async create(createQuickSlotDto: CreateQuickSlotDto) {
    this.validateTimeRange(
      createQuickSlotDto.startTime,
      createQuickSlotDto.endTime,
    );

    const existingSlot = await this.quickSlotsRepository.findOne({
      where: {
        bookingDate: createQuickSlotDto.bookingDate,
        startTime: createQuickSlotDto.startTime,
        endTime: createQuickSlotDto.endTime,
      },
    });

    if (existingSlot) {
      throw new BadRequestException(
        'Quick slot already exists for this day and time range.',
      );
    }

    const quickSlot = this.quickSlotsRepository.create({
      ...createQuickSlotDto,
      maxPlayers: createQuickSlotDto.maxPlayers ?? 12,
    });
    return this.quickSlotsRepository.save(quickSlot);
  }

  async update(id: number, dto: UpdateQuickSlotDto) {
    const slot = await this.quickSlotsRepository.findOne({ where: { id } });
    if (!slot) {
      throw new NotFoundException(`Quick slot ${id} not found.`);
    }
    slot.maxPlayers = dto.maxPlayers;
    return this.quickSlotsRepository.save(slot);
  }

  async findMatchingSlot(
    bookingDate: string,
    startTime: string,
    endTime: string,
  ) {
    return this.quickSlotsRepository.findOne({
      where: { bookingDate, startTime, endTime },
    });
  }

  async remove(id: number) {
    const quickSlot = await this.quickSlotsRepository.findOne({ where: { id } });

    if (!quickSlot) {
      throw new NotFoundException(`Quick slot ${id} not found.`);
    }

    await this.quickSlotsRepository.remove(quickSlot);
    return { id, deleted: true };
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('End time must be later than start time.');
    }
  }
}
