import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { CreateQuickSlotDto } from './dto/create-quick-slot.dto';
import { QuickSlotsService } from './quick-slots.service';

@Controller('quick-slots')
export class QuickSlotsController {
  constructor(private readonly quickSlotsService: QuickSlotsService) {}

  @Public()
  @Get()
  findByDate(@Query('date') bookingDate: string) {
    return this.quickSlotsService.findByDate(bookingDate);
  }

  @Post()
  create(@Body() createQuickSlotDto: CreateQuickSlotDto) {
    return this.quickSlotsService.create(createQuickSlotDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quickSlotsService.remove(id);
  }
}
