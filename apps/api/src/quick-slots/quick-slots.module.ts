import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { QuickSlot } from './entities/quick-slot.entity';
import { QuickSlotsController } from './quick-slots.controller';
import { QuickSlotsService } from './quick-slots.service';

@Module({
  imports: [TypeOrmModule.forFeature([QuickSlot, Booking])],
  controllers: [QuickSlotsController],
  providers: [QuickSlotsService],
  exports: [QuickSlotsService],
})
export class QuickSlotsModule {}
