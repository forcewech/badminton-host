import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from '../courts/entities/court.entity';
import { EquipmentItem } from '../equipment/entities/equipment-item.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Court, EquipmentItem])],
  providers: [SeedService],
})
export class SeedModule {}
