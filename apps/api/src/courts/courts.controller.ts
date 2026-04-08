import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { CourtsService } from './courts.service';

@Controller('courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get()
  findAll() {
    return this.courtsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.courtsService.findOne(id);
  }

  @Post()
  create(@Body() createCourtDto: CreateCourtDto) {
    return this.courtsService.create(createCourtDto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCourtDto: UpdateCourtDto,
  ) {
    return this.courtsService.update(id, updateCourtDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.courtsService.remove(id);
  }
}
