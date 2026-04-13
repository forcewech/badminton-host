import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickSlot } from './entities/quick-slot.entity';
import { QuickSlotsController } from './quick-slots.controller';
import { QuickSlotsService } from './quick-slots.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuickSlot])],
  controllers: [QuickSlotsController],
  providers: [QuickSlotsService],
  exports: [QuickSlotsService],
})
export class QuickSlotsModule {}
