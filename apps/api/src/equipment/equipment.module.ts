import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentItem } from './entities/equipment-item.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [TypeOrmModule.forFeature([EquipmentItem])],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService, TypeOrmModule],
})
export class EquipmentModule {}
