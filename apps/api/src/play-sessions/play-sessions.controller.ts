import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PlaySessionsService } from './play-sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddPlayerDto } from './dto/add-player.dto';
import { StartMatchDto } from './dto/start-match.dto';
import { UpdateScoreDto } from './dto/update-score.dto';

@Controller('play-sessions')
export class PlaySessionsController {
  constructor(private readonly playSessionsService: PlaySessionsService) {}

  @Get()
  findAll() {
    return this.playSessionsService.findAll();
  }

  @Get('booking-slots')
  getBookingSlots(@Query('date') date: string) {
    return this.playSessionsService.findBookingSlots(date ?? '');
  }

  @Get('slot-bookings')
  getSlotBookings(
    @Query('date') date: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
  ) {
    return this.playSessionsService.findSlotBookings(date ?? '', startTime ?? '', endTime ?? '');
  }

  @Post('from-booking-slot')
  createFromBookingSlot(
    @Body() body: { date: string; startTime: string; endTime: string; numberOfCourts?: number },
  ) {
    return this.playSessionsService.createFromBookingSlot(body.date, body.startTime, body.endTime, body.numberOfCourts);
  }

  @Post()
  create(@Body() dto: CreateSessionDto) {
    return this.playSessionsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playSessionsService.findOne(id);
  }

  @Public()
  @Get(':id/board')
  getBoard(@Param('id', ParseIntPipe) id: number) {
    return this.playSessionsService.findOne(id);
  }

  @Patch(':id/courts')
  updateCourts(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { numberOfCourts: number },
  ) {
    return this.playSessionsService.updateCourts(id, body.numberOfCourts);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'ACTIVE' | 'ENDED' },
  ) {
    return this.playSessionsService.updateStatus(id, body.status);
  }

  @Post(':id/players')
  addPlayer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPlayerDto,
  ) {
    return this.playSessionsService.addPlayer(id, dto);
  }

  @Delete(':id/players/:playerId')
  removePlayer(
    @Param('id', ParseIntPipe) id: number,
    @Param('playerId', ParseIntPipe) playerId: number,
  ) {
    return this.playSessionsService.removePlayer(id, playerId);
  }

  @Patch(':id/players/:playerId/check-in')
  checkInPlayer(
    @Param('id', ParseIntPipe) id: number,
    @Param('playerId', ParseIntPipe) playerId: number,
  ) {
    return this.playSessionsService.checkInPlayer(id, playerId);
  }

  @Post(':id/matches')
  startMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartMatchDto,
  ) {
    return this.playSessionsService.startMatch(id, dto);
  }

  @Patch(':id/matches/:matchId/score')
  updateScore(
    @Param('id', ParseIntPipe) id: number,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() dto: UpdateScoreDto,
  ) {
    return this.playSessionsService.updateScore(id, matchId, dto);
  }

  @Patch(':id/matches/:matchId/end')
  endMatch(
    @Param('id', ParseIntPipe) id: number,
    @Param('matchId', ParseIntPipe) matchId: number,
  ) {
    return this.playSessionsService.endMatch(id, matchId);
  }
}
