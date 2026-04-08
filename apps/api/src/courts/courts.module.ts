import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Court } from './entities/court.entity';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Court])],
  controllers: [CourtsController],
  providers: [CourtsService],
  exports: [CourtsService, TypeOrmModule],
})
export class CourtsModule {}
