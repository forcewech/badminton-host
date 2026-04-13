import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateQuickSlotDto } from './dto/create-quick-slot.dto';
import { QuickSlot } from './entities/quick-slot.entity';

@Injectable()
export class QuickSlotsService {
  constructor(
    @InjectRepository(QuickSlot)
    private readonly quickSlotsRepository: Repository<QuickSlot>,
  ) {}

  findByDate(bookingDate: string) {
    if (!bookingDate) {
      throw new BadRequestException('Booking date is required.');
    }

    return this.quickSlotsRepository.find({
      where: { bookingDate },
      order: {
        startTime: 'ASC',
        endTime: 'ASC',
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

    const quickSlot = this.quickSlotsRepository.create(createQuickSlotDto);
    return this.quickSlotsRepository.save(quickSlot);
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
