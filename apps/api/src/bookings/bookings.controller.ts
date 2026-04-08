import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { AssignCourtDto } from './dto/assign-court.dto';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Patch(':id/assign-court')
  assignCourt(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignCourtDto: AssignCourtDto,
  ) {
    return this.bookingsService.assignCourt(id, assignCourtDto);
  }

  @Patch(':id/deposit')
  confirmDeposit(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.confirmDeposit(id);
  }

  @Patch(':id/check-in')
  checkIn(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.checkIn(id);
  }

  @Patch(':id/full-payment')
  confirmFullPayment(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.confirmFullPayment(id);
  }

  @Patch(':id/no-show')
  markNoShow(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.markNoShow(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.remove(id);
  }
}
