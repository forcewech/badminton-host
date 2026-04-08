import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentItem } from './entities/equipment-item.entity';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(EquipmentItem)
    private readonly equipmentRepository: Repository<EquipmentItem>,
  ) {}

  findAll() {
    return this.equipmentRepository.find({
      order: { id: 'ASC' },
    });
  }

  async update(id: number, updateEquipmentDto: UpdateEquipmentDto) {
    const item = await this.equipmentRepository.findOne({ where: { id } });

    if (!item) {
      throw new NotFoundException(`Equipment item ${id} not found`);
    }

    Object.assign(item, updateEquipmentDto);
    return this.equipmentRepository.save(item);
  }
}
