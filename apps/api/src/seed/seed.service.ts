import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Court } from '../courts/entities/court.entity';
import { EquipmentItem } from '../equipment/entities/equipment-item.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Court)
    private readonly courtsRepository: Repository<Court>,
    @InjectRepository(EquipmentItem)
    private readonly equipmentRepository: Repository<EquipmentItem>,
  ) {}

  async onModuleInit() {
    await this.seedCourts();
    await this.seedEquipment();
  }

  private async seedCourts() {
    const count = await this.courtsRepository.count();

    if (count > 0) {
      return;
    }

    await this.courtsRepository.save([
      {
        name: 'Court A',
        zone: 'North Hall',
        hourlyRate: 240,
        isActive: true,
      },
      {
        name: 'Court B',
        zone: 'Center Hall',
        hourlyRate: 260,
        isActive: true,
      },
      {
        name: 'Court C',
        zone: 'South Hall',
        hourlyRate: 280,
        isActive: true,
      },
    ]);
  }

  private async seedEquipment() {
    const count = await this.equipmentRepository.count();

    if (count > 0) {
      return;
    }

    await this.equipmentRepository.save([
      {
        name: 'Training shuttle tubes',
        quantityAvailable: 18,
        quantityInUse: 6,
        isChecked: true,
        conditionNotes: 'Reorder when stock drops below 10 tubes.',
      },
      {
        name: 'Rental rackets',
        quantityAvailable: 14,
        quantityInUse: 4,
        isChecked: true,
        conditionNotes: 'Replace grip on two rackets after evening session.',
      },
      {
        name: 'Scoreboards',
        quantityAvailable: 3,
        quantityInUse: 2,
        isChecked: false,
        conditionNotes: 'South hall scoreboard battery is weak.',
      },
    ]);
  }
}
