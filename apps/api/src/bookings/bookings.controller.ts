import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssignCourtDto } from './dto/assign-court.dto';
import { CloudinaryService } from './cloudinary.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateMatchTrackingDto } from './dto/update-match-tracking.dto';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Post('upload-photo')
  @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(@UploadedFile() file: { buffer?: Buffer; mimetype?: string }) {
    return this.cloudinaryService.uploadCustomerPhoto(file);
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

  @Patch(':id/match-tracking')
  updateMatchTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMatchTrackingDto: UpdateMatchTrackingDto,
  ) {
    return this.bookingsService.updateMatchTracking(id, updateMatchTrackingDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.remove(id);
  }
}
