import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { Court } from './entities/court.entity';

@Injectable()
export class CourtsService {
  constructor(
    @InjectRepository(Court)
    private readonly courtsRepository: Repository<Court>,
  ) {}

  findAll() {
    return this.courtsRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number) {
    const court = await this.courtsRepository.findOne({ where: { id } });

    if (!court) {
      throw new NotFoundException(`Court ${id} not found`);
    }

    return court;
  }

  create(createCourtDto: CreateCourtDto) {
    const court = this.courtsRepository.create(createCourtDto);
    return this.courtsRepository.save(court);
  }

  async update(id: number, updateCourtDto: UpdateCourtDto) {
    const court = await this.findOne(id);
    Object.assign(court, updateCourtDto);
    return this.courtsRepository.save(court);
  }

  async remove(id: number) {
    const court = await this.findOne(id);

    try {
      await this.courtsRepository.remove(court);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new BadRequestException(
          'This court cannot be deleted because it still has booking history.',
        );
      }

      throw error;
    }

    return {
      id,
      deleted: true,
    };
  }
}
